const express       = require('express');
const http          = require('http');
const path          = require('path');
const NATS          = require('nats');
const mongoDB       = require("mongodb");
const mongoose      = require('mongoose');
const socketio      = require('socket.io');
const expressHbs    = require('express-handlebars');

const router        = express();
const server        = http.createServer(router);
const io            = socketio.listen(server);

var URI             = 'mongodb://localhost:27017/vehicle-data';
var Vehicle         = require('./models/vehicle-data');
var Errors          = require('./models/error');
var vehicles        = [];
var connections     = [];
var reconnecting    = false;
var errorCount      = 0;
var latestTime      = 0;
var y               = 0;
var lastEnergyLvl   = 0;

//Connect mongoose 
mongoose.connect(URI);

//Router setup
router.use(express.static(path.resolve(__dirname, 'public')));

router.engine('.hbs', expressHbs({
  defaultLayout: 'main',
  extname: '.hbs',
  partialsDir: __dirname + '/views/partials/'
}));

Errors.count((err, errors) => {
  return err ?
    handleError(err,'Counting errors'):
    errorCount = errors;
})

router.set('view engine', '.hbs');

//Connect NATS
const nats = NATS.connect({json:true})
//Acknowledge NATS connection
nats.on('connect',() => {
  console.log('NATS online');
});
//Receive messages from publisher
nats.subscribe('vehicle.test-bus-1', function(data) {
  if(!reconnecting){
  console.log(1)
    addToDB(data, true)
  }
});

//Initiate on connection with client
io.sockets.on('connection',socket => {
    //Initiate on change to database collection
    Vehicle.watch().on('change', stream => {
      let data = stream.fullDocument
        socket.emit('new message', {
          data
        });
    });
    
    Vehicle.watch().on('error', error => {
      handleError(error,'MongoDB changestream error')
    })
    
    Vehicle.watch().on('close', close => {
      handleError(close,'MongoDB changestream closed')
    })
    
    socket.on('connect_timeout', (timeout) => {
      handleError(timeout,'Socket timed out')
    });
    
    socket.on('disconnect', (reason) => {
        handleError('Lost connection with client','Socket.io');
        reconnect(5000);
    });
    
    socket.on('new error', (error) => {
      handleError(error,'Socket error')
    });
    
    Errors.watch().on('change', newErrors => {
        //Send error to client
        console.log(errorCount);
        errorCount++
        let errors = {count:errorCount, err:newErrors};
        socket.emit('new error', {
          errors
        })
        
    });
    //Acknowledge socket connection
    connected();
})

//Get homepage
router.get('/', (req ,res) => {
    res.render('index',{errorCount:errorCount, js: 'index', css:'index'})
})

//Get errors page
router.get('/error', (req ,res) => {
    Errors.find({}).sort({ savedTime: 'asc' }).exec((err, foundErrors) => {
      console.log(foundErrors)
    err?
      handleError(err, 'Getting errors from DB'):
      res.render('error', {error: foundErrors, errorCount:errorCount, js: 'error', css:'error'});
  })
})

//Get log
router.get('/log', (req ,res) => {
    res.render('log',{errorCount:errorCount, js: 'log', css:'log'})
})

//Get errors from client
router.get('/error-handler/:error/:operation', (req ,res) => {
    handleError(req.params.error,req.params.operation)
})

//Get the previous route
router.get('/drive-back/:start/:reverse', (req ,res) => {
  console.log('drive back',req.params.start);
      Vehicle.find({savedTime :{$gt: req.params.start}}).exec((err, route) => {
      err ? 
        handleError(err,'Getting route from database'):
        drive(req.params.reverse ? route.reverse() : route );
    })
    
})
//Get all data
//Add data to database
function addToDB(data, formatted, from){
  //Create new vehicle
  var newVehicle = new Vehicle({
    time: data.time,
    savedTime:  Date.now(),
    formattedTime: formatTime(),
    energy: data.energy,
    energySpent:formatted ? lastEnergyLvl - data.energy : data.energySpent,
    gps:formatted ? getCoordinatesObj(data.gps) : data.gps,
    odo: data.odo,
    speed: data.speed,
    soc: data.soc
  });
  lastEnergyLvl = data.energy;
  //Save new vehicle to database    
  newVehicle.save((err,savedVehicle) => {
    console.log(2)
    return err ? 
      handleError(err, 'Saving Vehicle'):0;
  });
}

//Get latitude and longitude in an object for Google Maps API
function getCoordinatesObj(gps){
  let latLong = gps ? gps.split('|') : [];
  return latLong.length > 0 ?
    {
      lat:Number(latLong[0]),
      lng:Number(latLong[1])
    }:
    handleError(gps,'Getting GPS data');
}

//Error handling
function handleError(error, operation){
  
  console.log(`${error} at ${operation}`);
  
  var newError = new Errors({
    time:formatTime(),
    error:error,
    operation:operation
  });
  
  //Save new error to database    
  newError.save((error,res) => {
    if(error) return handleError(error,'Saving Error');
  });
}


//Acknowledge connection from client
function connected(socket){
    console.log('Connected to socket')
    connections.push(socket);
}

//Check energy usage
function calcEnergySpent(energy){
  return new Promise(resolve => {
    lastEnergyLvl == energy ?
      resolve(0) :
      resolve(parseFloat((lastEnergyLvl - energy).toFixed(4)));
      
      lastEnergyLvl = energy;
  })
}

//Get formatted time
function formatTime(ts){
  
  var time = new Date( Date.now() + 7200000);
  return time.toISOString().replace('T',' ').split('.')[0];
}

//Feed data back to DB (and to client)
function drive(route){
  route.forEach((data, inx) => {
    setTimeout(() => {
      addToDB(data, false);
    },(150 * inx))
  })
}

function reconnect(timeout){
  console.log('Reconnecting...')
  if(!reconnecting){
    
    reconnecting = true;
    setTimeout(() => {
      
        reconnecting = false;      
    },timeout)
  } 
}

//Listen on 8080 (required by the C9 IDE)
server.listen(process.env.PORT || 8080, process.env.IP ||'127.0.0.1', function(){
  var addr = server.address();
  console.log("Server listening at", addr.address + ":" + addr.port);
});
