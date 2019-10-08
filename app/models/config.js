const mongoose = require('mongoose')

let configSchema = mongoose.Schema({
  keywords: [String],
  proxies: [String],
  filtered: [{
    serverID: String,
    webhook: String,
    napWebhookUS: String,
    logo: String,
    color: String,
    footer: String,
  }],
  unfiltered: [{
    serverID: String,
    webhook: String,
    napWebhookUS: String,
    logo: String,
    color: String,
    footer: String,
  }],
})
//new Date(+new Date() + 30*24*60*60*1000)
module.exports = mongoose.model('Config',configSchema)