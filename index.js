import bodyParser from "body-parser";
import express from "express";
import { chromium } from "playwright";

const app = express();
const port = 3000;

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: false }));

app.get("/", (req, res) => {
  res.render("index.ejs");
});

let products;
let noProducts = false;
app.post("/product", async (req, res) => {
  products = [];
  const productName = req.body.product;

  const searchProducts = [
    searchProductFalabella,
    searchProductExito,
    searchProductAlkosto,
    searchProductMercadoLibre,
    searchProductOlimpica,
  ];

  await Promise.all(
    searchProducts.map(async (searchFunction) => {
      try {
        await searchFunction(productName);
      } catch (err) {
        console.error(`Error occurred in:`, err);
        return [];
      }
    })
  );

  // Verify if there are products
  noProducts = products.length === 0;

  res.redirect(`/products?page=1`);
});

let sortBy = "shop"; // Default sort by shop
app.get("/products", (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const pageSize = 5;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  sortBy = req.query.sortBy || sortBy;
  const sortedProducts = orderProducts(products, sortBy);

  const paginatedProducts = sortedProducts.slice(startIndex, endIndex);

  res.render("index.ejs", {
    products: paginatedProducts,
    currentPage: page,
    totalPages: Math.ceil(products.length / pageSize),
    sortBy,
    noProducts,
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

const searchProductMercadoLibre = async (product) => {
  console.log("inicio Mercado Libre");
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto("https://www.mercadolibre.com.co/");
    await page.waitForLoadState("domcontentloaded");

    //Write the product in the search bar
    await page.click("#cb1-edit");
    await page.$eval(
      "#cb1-edit",
      (element, product) => {
        element.value = product;
      },
      product
    );
    //Search the product
    await page.click(".nav-search-btn");
    await page.waitForLoadState("domcontentloaded");

    // Get all the elements
    const productElements = await page.$$(".ui-search-item__title");
    const numberOfProducts = productElements.length;

    const productsDescription = [];
    const productsName = [];
    const productsLink = [];
    const productsImg = [];
    const prices = [];

    for (let i = 0; i < numberOfProducts; i++) {
      //Get the name of the products
      await page.waitForSelector(".ui-search-item__title");
      const elementsName = await page.$$(".ui-search-item__title");

      const title = await elementsName[i].evaluate((el) =>
        el.textContent.trim()
      );

      //Get the prices
      await page.waitForSelector(
        ".andes-money-amount.ui-search-price__part.ui-search-price__part--medium.andes-money-amount--cents-superscript"
      );
      const elementsPrice = await page.$$(
        ".andes-money-amount.ui-search-price__part.ui-search-price__part--medium.andes-money-amount--cents-superscript"
      );

      if (verifyNameProduct(product, title)) {
        productsName.push(title);

        const price = await elementsPrice[i].evaluate((el_price) => {
          return el_price.textContent.trim();
        });

        prices.push(price);

        await page.waitForSelector(".ui-search-result-image__element");
        const productElements = await page.$$(".ui-search-item__title");
        // Click on the product title to view its description
        await productElements[i].click();
        await page.waitForLoadState("domcontentloaded");

        // Extract the descriptions of the product
        const prodDesc_i = await page.$$eval(
          ".ui-vpp-highlighted-specs__features-list li", // Targeting individual list items (li elements)
          (listItems) => {
            // Map over each list item and return its text content with newline characters
            return listItems.map((item) => {
              return item.textContent.trim();
            });
          }
        );

        //Some products don't have the description where it should be, so we need to look for it below the product
        if (prodDesc_i.length != 0) {
          productsDescription.push(prodDesc_i);
        } else {
          const prodDesc = await page.$eval(
            ".ui-pdp-description__content",
            (desc) => {
              return desc.textContent.trim();
            }
          );

          productsDescription.push([prodDesc.slice(0, 300) + "..."]);
        }

        //Get the link of the img
        await page.waitForSelector(
          ".ui-pdp-image.ui-pdp-gallery__figure__image"
        );
        const prodImg = await page.$eval(
          ".ui-pdp-image.ui-pdp-gallery__figure__image",
          (el_img) => {
            return el_img.src;
          }
        );
        productsImg.push(prodImg);

        // Get the link of the products, in case the user wants to buy one of them
        productsLink.push(page.url());

        // Navigate back to the previous page
        await page.goBack();
      }

      if (productsName.length === 5) {
        break;
      }
    }

    // Take a screenshot of the page
    //NOTE: This is just for testing purposes
    //await page.screenshot({ path: "ssMercadoLibre.png" });
    console.log("fin Mercado Libre");
    await browser.close();

    //Create the JSON object of the products
    const productsMercadoLibre = createJSONObject(
      "Mercado Libre",
      productsName,
      prices,
      productsImg,
      productsDescription,
      productsLink,
      productsName.length
    );

    products.push(...productsMercadoLibre);
  } catch (error) {
    console.error(
      "Error occurred while searching for products on Mercado Libre:",
      error
    );
    throw error; // Re-throw the error after logging it
  }
};

const searchProductAlkosto = async (product) => {
  console.log("inicio Alkosto");
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto("https://www.alkosto.com.co/");
    await page.waitForLoadState("domcontentloaded");

    // Write the product in the search bar
    await page.click("#js-site-search-input");
    await page.$eval(
      "#js-site-search-input",
      (element, product) => {
        element.value = product;
      },
      product
    );
    // Simulate pressing the "Enter" key to search for the product
    await page.keyboard.press("Enter");
    // await page.waitForLoadState("networkidle");
    // await page.screenshot({ path: "ssAlkosto.png" });

    await page.waitForSelector(
      ".ais-InfiniteHits-item.product__item.js-product-item.js-algolia-product-click"
    );
    //Get the name of the first 5 products
    const productsName = await page.$$eval(
      ".ais-InfiniteHits-item.product__item.js-product-item.js-algolia-product-click",
      (el_names) =>
        el_names.slice(0, 5).map((el_name) => {
          return el_name.children[0].children[0].textContent.trim();
        })
    );

    const numberOfProducts = productsName.length;

    //Get the img of the first 5 products
    const productsImg = await page.$$eval(
      ".ais-InfiniteHits-item.product__item.js-product-item.js-algolia-product-click",
      (el_names) =>
        el_names.slice(0, 5).map((el_name) => {
          return el_name.children[1].children[0].children[0].src;
        })
    );

    //Get the description, the links of the products and their prices
    const productsLink = [];
    const productsDescription = [];
    const prices = [];
    for (let i = 0; i < numberOfProducts; i++) {
      // Wait for the selector
      await page.waitForSelector(
        ".product__item__top__title.js-algolia-product-click.js-algolia-product-title"
      );

      // Get the data-url attribute of the element
      const productUrls = await page.$$eval(
        ".product__item__top__title.js-algolia-product-click.js-algolia-product-title",
        (elements) => elements.map((el) => el.getAttribute("data-url"))
      );
      await page.goto(`https://www.alkosto.com.co${productUrls[i]}`);
      await page.waitForLoadState("domcontentloaded");
      await page.screenshot({ path: `ssAlkosto.png` });

      await page.waitForSelector(".tab-details__keyFeatures--list");
      // Extract the descriptions of the product
      const prodDesc_i = await page.$$eval(
        ".tab-details__keyFeatures--list li", // Targeting individual list items (li elements)
        (listItems) => {
          // Map over each list item and return its text content with newline characters
          return listItems.map((item) => {
            return item.textContent.trim();
          });
        }
      );
      productsDescription.push(prodDesc_i);

      // Extract the price of the product
      const price_i = await page.$eval("#js-original_price", (priceElem) => {
        return priceElem.textContent.trim().split(" ")[0];
      });
      prices.push(price_i);

      // Get the link of the products, in case the user wants to buy one of them
      productsLink.push(page.url());

      // Navigate back to the previous page
      await page.goBack();
    }

    await page.waitForLoadState("domcontentloaded");
    console.log("fin Alkosto");

    await browser.close();

    //Create the JSON object of the products
    const productsAlkosto = createJSONObject(
      "Alkosto",
      productsName,
      prices,
      productsImg,
      productsDescription,
      productsLink,
      numberOfProducts
    );

    products.push(...productsAlkosto);
  } catch (error) {
    console.error(
      "Error occurred while searching for products on Alkosto:",
      error
    );
    throw error; // Re-throw the error after logging it
  }
};

const searchProductOlimpica = async (product) => {
  console.log("inicio Olimpica");
  try {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto("https://www.olimpica.com.co/");

    await page.waitForSelector(
      ".olimpica-advance-geolocation-0-x-containerTrigger"
    );

    // Write the product in the search bar
    await page.fill("input", product);
    await page.press("input", "Enter");

    // Simulate pressing the Enter key

    const productsName = [];
    const prices = [];
    const productsImg = [];
    const productsLink = [];
    const productsDescription = [];

    await page.waitForLoadState("load");
    await page.waitForTimeout(30000);
    await page.waitForSelector(".false.olimpica-dinamic-flags-0-x-listPrices");

    const numberOfElements = await page.$$(
      ".vtex-product-summary-2-x-productBrand.vtex-product-summary-2-x-brandName.t-body"
    );

    for (let i = 0; i < numberOfElements.length; i++) {
      await page.waitForSelector(
        ".vtex-product-summary-2-x-productBrand.vtex-product-summary-2-x-brandName.t-body"
      );

      //Wait to get the elements title
      const elementsName = await page.$$(
        ".vtex-product-summary-2-x-productBrand.vtex-product-summary-2-x-brandName.t-body"
      );

      const elementsPrice = await page.$$(
        ".false.olimpica-dinamic-flags-0-x-listPrices"
      );

      const elementsName_Link = await page.$$(
        ".vtex-product-summary-2-x-clearLink.vtex-product-summary-2-x-clearLink--product-summary.h-100.flex.flex-column"
      );

      const elementsImg = await page.$$(
        ".dib.relative.vtex-product-summary-2-x-imageContainer.vtex-product-summary-2-x-imageStackContainer.vtex-product-summary-2-x-hoverEffect"
      );

      //Get the title of the product
      let title = await elementsName[i].evaluate((tit) =>
        tit.textContent.trim()
      );

      //Check if the title of the element includes the product the user wants
      if (verifyNameProduct(product, title)) {
        productsName.push(title);

        //Get the link
        const link = await elementsName_Link[i].evaluate((link) => link.href);
        productsLink.push(link);

        // Get the price
        let price = await elementsPrice[i].evaluate((price) =>
          price.children[0].children[0].textContent.trim()
        );
        prices.push(price);

        //Get the img src
        const src = await elementsImg[i].evaluate((img) => img.children[0].src);
        productsImg.push(src);

        productsDescription.push(["Más información del producto en el enlace"]);
      }

      //Get only the first 5 products
      if (productsName.length === 5) {
        break;
      }
    }

    // Take a screenshot of the page
    //NOTE: This is just for testing purposes
    await page.screenshot({ path: "ssOlimpica.png" });

    await browser.close();
    console.log("Fin Olimpica");

    //Create the JSON object of the products
    const productsOlimpica = createJSONObject(
      "Olímpica",
      productsName,
      prices,
      productsImg,
      productsDescription,
      productsLink,
      productsName.length
    );
    products.push(...productsOlimpica);
  } catch (error) {
    console.error(
      "Error occurred while searching for products on Olímpica:",
      error
    );
    throw error; // Re-throw the error after logging it
  }
};

const searchProductExito = async (product) => {
  console.log("inicio Exito");
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto("https://www.exito.com/");
    await page.waitForLoadState("domcontentloaded");

    // Write the product in the search bar
    await page.click("[data-testid='store-input']");
    await page.$eval(
      "[data-testid='store-input']",
      (element, product) => {
        element.value = product;
      },
      product
    );
    // Simulate pressing the Enter key
    await page.keyboard.press("Enter");
    //await page.waitForLoadState("networkidle");

    await page.waitForSelector("[data-testid='store-product-card-content']");
    const productsName = [];
    const prices = [];
    const productsImg = [];
    const productsLink = [];
    const productsDescription = [];

    //Get the elements that have the information of the product
    const numberOfElements = await page.$$(
      "[data-testid='store-product-card-content']"
    );

    for (let i = 0; i < numberOfElements.length; i++) {
      await page.waitForSelector(".ProductPrice_container__price__XmMWA");
      //Get the elements that have the information of the product
      const elementsName_Link = await page.$$(
        "[data-testid='store-product-card-content']"
      );
      const elementsPrice = await page.$$(
        ".ProductPrice_container__price__XmMWA"
      );
      const elementsImg = await page.$$(".imagen_plp");

      //Get the title of the product
      const title = await elementsName_Link[i].evaluate((tit) =>
        tit.children[0].children[0].children[1].children[0].textContent.trim()
      );

      //Check if the title of the element includes the product the user wants
      if (verifyNameProduct(product, title)) {
        productsName.push(title);

        //Get the link
        const link = await elementsName_Link[i].evaluate(
          (link) => link.children[0].children[0].children[1].children[0].href
        );
        productsLink.push(link);

        //Get the price
        const price = await elementsPrice[i].evaluate((price) =>
          price.textContent.trim()
        );
        prices.push(price);

        //Get the img src
        const src = await elementsImg[i].evaluate((img) => img.src);
        productsImg.push(src);

        //Get the description
        await page.goto(link);
        await page.waitForLoadState("domcontentloaded");

        await page.waitForSelector("#product-details-content-panel--0");
        // Get the specifications and push them into an array
        const specifications = await page.evaluate(() => {
          const specElements = document.querySelectorAll(
            '.product-specifications_fs-product-details-content__upn_w [data-fs-content-specification="true"] div'
          );
          const specsArray = [];

          specElements.forEach((specElement) => {
            const title = specElement
              .querySelector('[data-fs-title-specification="true"]')
              .textContent.trim();
            const text = specElement
              .querySelector('[data-fs-text-specification="true"]')
              .textContent.trim();
            specsArray.push(`${title}: ${text}`);
          });

          return specsArray;
        });
        specifications.length !== 0
          ? productsDescription.push(specifications)
          : productsDescription.push([
              "Más información del producto en el enlace",
            ]);

        await page.goBack();
        await page.waitForLoadState("domcontentloaded");
      }

      //Get only the first 5 products
      if (productsName.length === 5) {
        break;
      }
    }

    // Take a screenshot of the page
    //NOTE: This is just for testing purposes
    await page.screenshot({ path: "ssExito.png" });

    await browser.close();
    console.log("Fin Exito");

    //Create the JSON object of the products
    const productsExito = createJSONObject(
      "Éxito",
      productsName,
      prices,
      productsImg,
      productsDescription,
      productsLink,
      productsName.length
    );
    products.push(...productsExito);
  } catch (error) {
    console.error(
      "Error occurred while searching for products on Éxito:",
      error
    );
    throw error; // Re-throw the error after logging it
  }
};

const searchProductFalabella = async (product) => {
  console.log("inicio Falabella");
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto("https://www.falabella.com.co/falabella-co");
    await page.waitForLoadState("domcontentloaded");

    // Write the product in the search bar
    await page.click("#testId-SearchBar-Input");
    await page.keyboard.type(product);

    // Simulate pressing the Enter key
    await page.keyboard.press("Enter");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "ssFalabella.png" });

    const productsName = [];
    const prices = [];
    const productsImg = [];
    const productsLink = [];
    const productsDescription = [];

    const numberOfElements = await page.$$(
      'b[id^="testId-pod-displaySubTitle"]'
    );

    for (let i = 0; i < numberOfElements.length; i++) {
      await page.waitForSelector('b[id^="testId-pod-displaySubTitle"]');

      //Wait to get the elements title
      const elementsName = await page.$$('b[id^="testId-pod-displaySubTitle"]');

      const elementsPrice = await page.$$(
        ".copy10.primary.medium.jsx-3451706699.normal.line-height-22"
      );

      const elementsName_Link = await page.$$(".jsx-1484439449");

      const elementsImg = await page.$$('div[class^="jsx-2469003054"]');

      const elementsDescription = await page.$$(
        ".jsx-4018082099.section__pod-bottom-description"
      );

      //Get the title of the product
      let title = await elementsName[i].evaluate((tit) =>
        tit.textContent.trim()
      );
      title = title.split("|")[0];

      //Check if the title of the element includes the product the user wants
      if (verifyNameProduct(product, title)) {
        productsName.push(title);

        //Get the link
        const link = await elementsName_Link[i].evaluate(
          (link) => link.children[0].href
        );
        productsLink.push(link);

        // Get the price
        let price = await elementsPrice[i].evaluate((price) =>
          price.textContent.trim()
        );
        price = price.split("-")[0];
        prices.push(price);

        //Get the img src
        const src = await elementsImg[i].evaluate(
          (img) => img.children[0]?.children[0]?.children[1]?.src
        );
        productsImg.push(src || "/images/no_img.png");

        let descriptions = [];
        if (elementsDescription.length > 0) {
          const descriptionItems = await elementsDescription[i].$$("li");
          if (descriptionItems.length > 0) {
            descriptions = await Promise.all(
              descriptionItems.map((item) =>
                item.evaluate((el) => el.textContent.trim())
              )
            );
          } else {
            descriptions.push("Más información del producto en el enlace"); // Agrega esta línea si no hay elementos de descripción
          }
        } else {
          descriptions.push("Más información del producto en el enlace"); // Agrega esta línea si no hay elementos de descripción
        }

        productsDescription.push(descriptions);

        //Get only the first 5 products
        if (productsName.length === 5) {
          break;
        }
      }
    }

    // Take a screenshot of the page
    //NOTE: This is just for testing purposes
    await page.screenshot({ path: "ssfalabella.png" });

    await browser.close();
    console.log("Fin Falabella");

    //Create the JSON object of the products
    const productsFalabella = createJSONObject(
      "Falabella",
      productsName,
      prices,
      productsImg,
      productsDescription,
      productsLink,
      productsName.length
    );
    products.push(...productsFalabella);
  } catch (error) {
    console.error(
      "Error occurred while searching for products on Falabella:",
      error
    );
    throw error; // Re-throw the error after logging it
  }
};

const createJSONObject = (
  shopName,
  productsName,
  prices,
  productsImg,
  productsDescription,
  productsLink,
  numberOfProducts
) => {
  const products = [];
  for (let i = 0; i < numberOfProducts; i++) {
    products.push({
      shop: shopName,
      name: productsName[i],
      price: prices[i],
      img: productsImg[i],
      description: productsDescription[i],
      link: productsLink[i],
    });
  }

  products.sort((a, b) => {
    // Extract the numeric values of prices
    const priceA = parseFloat(
      a.price.replace(/\$/g, "").replace(/\./g, "").replace(",", ".")
    );
    const priceB = parseFloat(
      b.price.replace(/\$/g, "").replace(/\./g, "").replace(",", ".")
    );

    // Compare the prices
    return priceA - priceB;
  });

  //Get the first 3 products
  return products.slice(0, 3);
};

const verifyNameProduct = (product, title) => {
  const words = product.split(" ");
  for (const word of words) {
    if (!title.toLowerCase().includes(word.toLowerCase())) {
      return false;
    }
  }

  return !title.toLowerCase().includes("case");
};

const orderProducts = (products, sortBy) => {
  let tempProducts = [...products];
  switch (sortBy) {
    case "lowPrice":
      tempProducts.sort((a, b) => {
        // Extract the numeric values of prices
        const priceA = parseFloat(
          a.price.replace(/\$/g, "").replace(/\./g, "").replace(",", ".")
        );
        const priceB = parseFloat(
          b.price.replace(/\$/g, "").replace(/\./g, "").replace(",", ".")
        );

        // Compare the prices
        return priceA - priceB;
      });
      break;
    case "highPrice":
      tempProducts.sort((a, b) => {
        // Extract the numeric values of prices
        const priceA = parseFloat(
          a.price.replace(/\$/g, "").replace(/\./g, "").replace(",", ".")
        );
        const priceB = parseFloat(
          b.price.replace(/\$/g, "").replace(/\./g, "").replace(",", ".")
        );

        // Compare the prices
        return priceB - priceA;
      });
      break;
    default:
      break;
  }
  return tempProducts;
};
