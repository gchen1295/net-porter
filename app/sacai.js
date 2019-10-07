require('dotenv').config()
var jar = require('request').jar();
const request = require('request-promise').defaults({
  jar: jar
});
const cheerio = require('cheerio')

async function login(user, pass)
{
  try
  {
    let res = await request({
      url: 'https://store.sacai.jp/login',
      method: 'get',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36',
        'Host': 'store.sacai.jp',
        'Origin': 'https://store.sacai.jp',
        'Referer': 'https://store.sacai.jp/login',
        'Upgrade-Insecure-Requests': '1'
      },
      followAllRedirects: true,
      //resolveWithFullResponse: true
    })
    let $ = cheerio.load(res)
    let csrf = $('input[name=fuel_csrf_token]').attr('value')
    console.log(csrf)
    res = await request({
      url: 'https://store.sacai.jp/login',
      method: 'post',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Host': 'store.sacai.jp',
        'Origin': 'https://store.sacai.jp',
        'Referer': 'https://store.sacai.jp/login',
        'Upgrade-Insecure-Requests': '1'
      },
      formData: {
        fuel_csrf_token: csrf,
        back_url: '',
        login_id: user,
        password: pass,
        check_preserve_login: '1',
        preserve_login_flag: '1',
      },
      followAllRedirects: true,
      //resolveWithFullResponse: true
    })
    $ = cheerio.load(res)
    let isLogged = $('li.gn-login').text()
    if(isLogged === 'LOGIN')
    {
      console.log('FAILED')
    }
    console.log(isLogged)
  }
  catch(err)
  {
    console.log(err)
  }
}

login('gchen1258@gmail.com', 'MXcWr2p4vn')