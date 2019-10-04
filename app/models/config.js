const mongoose = require('mongoose')

let configSchema = mongoose.Schema({
  keywords: [String],
  proxies: [String],
  filtered: [{
    webhook: String,
    logo: String,
    color: String
  }],
  unfiltered: [{
    webhook: String,
    logo: String,
    color: String
  }],
  //activeSub: {type: Boolean, default: false}
})
//new Date(+new Date() + 30*24*60*60*1000)
module.exports = mongoose.model('Config',configSchema)