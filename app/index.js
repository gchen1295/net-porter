const axios = require('axios')
const mongoose = require('mongoose')
const cheerio = require('cheerio')
const Products = require('./models/product')
let date = new Date()
let dateFormat = `${date.getFullYear()}-${date.getDay()}-${date.getMonth() + 1} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`

mongoose.connect(`mongodb://localhost:27017/monitor-test`, {
    useNewUrlParser: true,
    useCreateIndex: true
})
mongoose.Promise = global.Promise;

var webHookURLs = [
    ''
]

async function sendDicordWebhook(embedData) {
    for (url in webHookURLs) {
        axios.post(webHookURLs[url], embedData)
        console.log('Message sent!')
    }
}

startmonitor()

function startmonitor() {
    setTimeout(async function () {
        axios.get('')
            .then(data => {
                $ = cheerio.load(data.data)



                startmonitor()
            })
    }, 1000 )
}