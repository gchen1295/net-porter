const mongoose = require('mongoose');

const productSchema = mongoose.Schema({
    productTitle: {
        type: String,
    },
    productSizes: [{
      sizeName: {type: String, },
      pid: {type: String, }
    }
    ]
});

module.exports = mongoose.model('soleProduct', productSchema);