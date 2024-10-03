/*import { chromium } from "playwright";

const searchBtn = document.getElementById("search-btn");

searchBtn.addEventListener("click", (e) => {
  e.preventDefault();
  const product = document.getElementById("product").value;
  console.log(product);

  const priceML = searchProductMercadoLibre(product);
});

const searchProductMercadoLibre = async (product) => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("https://www.mercadolibre.com.co/");
  await page.waitForLoadState("domcontentloaded");
  await page.click("#cb1-edit");
  await page.$eval("#cb1-edit", (element) => {
    element.value = product;
  });
  await page.click(".nav-search-btn");
};*/
