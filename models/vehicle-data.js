const mongoose = require('mongoose');

var vehicleSchema = new mongoose.Schema({
    time:{type: Number, required: true},
    savedTime:{type: Number, required: true},
    formattedTime:{type: String, required: true},
    energy: {type: Number, required: true},
    energySpent: Number,
    gps:{type: Object, required: true},
    odo:{type: Number, required: true},
    speed:{type: Number, required: true},
    soc:{type: Number, required: true},
});

module.exports = mongoose.model('Vehicle',vehicleSchema);
