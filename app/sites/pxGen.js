const UserAgent = require('user-agents')
const userAgent = new UserAgent();
const puppeteer = require("puppeteer-extra");
// add stealth plugin and use defaults (all evasion techniques)
const pluginStealth = require("puppeteer-extra-plugin-stealth")
puppeteer.use(pluginStealth())
 
async function soleboxGenerator()
{
  try{
    let validCookie = false

    const browser = await puppeteer.launch({
      headless: true,
      defaultViewport: null,
      ignoreDefaultArgs: ["--enable-automation"],
      executablePath: chromePaths.chrome,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-position=0,0',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list',
        '--lang=en-US,en;q=0.9',
        `--user-agent=${userAgent.toString()}`,
      ],
      headless: true
    });
    // let pages = await browser.pages()
    // let page = pages[0]
    // await new Promise(resolve =>
    //   setTimeout(resolve, 1000)
    // );
    // let r1 = await page.goto('https://www.solebox.com/en/New/')
    // await page.mouse.move(256, 500)
    // await new Promise(resolve =>
    //   setTimeout(resolve, 250)
    // );
    // await page.mouse.move(10, 456)
    // await page.mouse.down()
    // await page.mouse.up()
    // await page.mouse.down()
    // await page.mouse.up()
    // await page.mouse.move(136, 523)
    // let cookies = await page.cookies('https://www.solebox.com/')
    // let headrs = r1.headers()
    // let ck = []
    // for(let i in cookies)
    // {
    //   if(cookies[i].name.includes('px'))
    //   {
    //     ck.push({
    //       name: cookies[i].name,
    //       value: cookies[i].value
    //     })
    //   }
    // }
    // page.close()

    const context = await browser.createIncognitoBrowserContext();
    page = await context.newPage();
    r1 = await page.goto('https://www.solebox.com/en/New/')
    await page.mouse.move(256, 500)
    await new Promise(resolve =>
      setTimeout(resolve, 250)
    );
    await page.mouse.move(10, 456)
    await page.mouse.down()
    await page.mouse.up()
    await page.mouse.down()
    await page.mouse.up()
    await page.mouse.move(136, 523)
    cookies = await page.cookies('https://www.solebox.com/')
    for(let i in cookies)
    {
      if(cookies[i].name.includes('px'))
      {
        ck.push({
          name: cookies[i].name,
          value: cookies[i].value
        })
      }
    }
    page.close()
    context.close()
    console.log(ck)
    
    // Check if abck is valid
    
    
  }catch(err)
  {
    console.log(err)
    console.log(jar)
  }
}

soleboxGenerator()