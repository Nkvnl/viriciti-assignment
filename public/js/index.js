var errorCounter        = document.querySelector('#errorCounter')
var errorLink           = document.querySelector('#errorLink')
var speedOMeter         = document.querySelector('.meter')
var lastUpdate          = document.querySelector('.time')
var total               = document.querySelector('#total')
var filler              = document.querySelector('.filler');
var energySpent         = document.querySelector('#energySpent');
var chargeCounter       = document.querySelector('#soc');
var soc                 = document.querySelector('#charge');
var distance            = document.querySelector('#distance');
var mapMarker           = document.querySelector('.mapMarker');
var redo                = document.querySelector('#redo');
var back                = document.querySelector('#back');
var statusIMG           = document.querySelector('#status-img');
var statusText          = document.querySelector('#status');
var alertDiv            = document.querySelector('#alert');

var sp                  = document.querySelector('#speedChart');
var esp                 = document.querySelector('#energySpentChart');
var ec                  = document.querySelector('#energyChart');
var options             = {elements: {line: {tension: 0}},scales: {yAxes:[{ticks:{beginAtZero: false}}]}}; 
var speedChart          = new Chart(sp, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Speed',
                        data: [],
                        backgroundColor: '#7CA364',
                        pointBorderColor:'transparent',
                        pointBackgroundColor:'transparent',
                        borderColor:'#7CA364',
                        borderWidth: 2
                    }],
                },
                options:options
            });
var energySpentChart    = new Chart(esp, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Energy Spent',
            data: [],
            backgroundColor: '#7CA364',
            pointBorderColor:'transparent',
            pointBackgroundColor:'transparent',
            borderColor:'#7CA364',
            borderWidth: 2
        }],
    },
    options:options
});
var energyChart         = new Chart(ec, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Energy',
            data: [],
            backgroundColor: 'transparent',
            pointBorderColor:'transparent',
            pointBackgroundColor:'transparent',
            borderColor:'#7CA364',
            borderWidth: 2
        }],
    },
    options:options
});
var chartsArray         = [speedChart, energyChart, energySpentChart] ;
var buttonsArray        = [back, redo];

var lastCoordinates     = {};
var lastGPS             = {};
var coordinates         = [];
var startTime           = 0;
var startODO            = 0;
var spentEnergy         = 0;
var x                   = 0;
var y                   = 0;

setInterval(checkPosition,5000)

var map
var polyLine;
var flightPath;

window.onload = function(){
    map = new google.maps.Map(document.querySelector('.map'), {
        center: {lat: -34.397, lng: 150.644},
        zoom: 16,
        disableDefaultUI: true
        
    });
    centerMarker();
}

window.onresize = function(){
    centerMarker();
};
      
var socket = io.connect();

socket.on('new message', obj => {
    let data = obj.data;
    y++
    
    //Update client data
    updateData(data);
    updateMap(data);
    
    //Update chart 1 in 5 messages
    if(y % 5      == 0) updateChart(data);
    if(startODO   == 0) startODO  = data.odo;
    if(startTime  == 0) startTime = data.savedTime;
        
});

socket.on('new error', obj => {
    animate(errorLink, alertDiv, obj.errors);
})

socket.on('disconnect', obj => {
    handleError('Socket disconnected','Socket.io');
    socket.connect();
})

//Let the bus drive back or start again
function driveBack(reverse){
    
    //Hide buttons
    showButtons(false);
    updateStatus('Online');
    
    //Send request to server
    var xhr = new XMLHttpRequest();
    xhr.open("GET", `/drive-back/${startTime}/${reverse}`);
    xhr.send();
    
    //Reset
    startTime = 0;
    startODO = 0;
    spentEnergy = 0;
}

//Display the right elements depending on bus movement
function moving(b, crd){
    b ? online() : offline();
    
    function online(){
        showButtons(false);
        updateStatus('Online');
        lastCoordinates = crd;
    }
    
    function offline(){
        updateSpeed('0');
        showButtons(true);
        updateStatus('Offline');
        handleError('Bus offline','Checking position')
    }
}
//Check if the bus is moving by comparing coordinates
function checkPosition(){
    let crd = coordinates[(coordinates.length - 1)]
    moving(lastCoordinates != crd,crd)
}
//Check distance / draw the polyline and pan to current position
function updateMap(data){
    
    if(haversineFormula(data)){
        let GPS = data.gps;
        console.log(GPS)
        drawPolyLine(GPS,map);
        map.panTo(GPS);
        
    } else {
        
        handleError('Detected unrealistic movement in GPS coordinates','haversineFormula')
    }
}

//Update all data 
function updateData(data){
    
    updateTime(data.formattedTime);
    updateSpeed(data.speed);
    updateOdo(data.odo);
    updateSOC(data.soc);
    updateCharge(data.energy);
    updateDistance(data.odo);
}

//Center the marker on the map
function centerMarker(){
    
    let w = document.querySelector('.map').offsetWidth;
    mapMarker.style.left = `${8 + (w / 2)}px`
}

//Draw a polyline behind bus
function drawPolyLine(GPS){
    console.log(coordinates)
    //Push new coordinates
    coordinates.push(GPS);
    
    //Trace new polyline acc to coordinates
    polyLine = new google.maps.Polyline({
      path: coordinates,
      strokeColor: '#dc3545',
      strokeOpacity: .8,
      strokeWeight: 2
    });
    
    //Apply to the map
    polyLine.setMap(map);
    if(coordinates.length > 10) coordinates.splice(0,1);
}

//Update all the charts
function updateChart(data){
    let input = {
        data:[data.speed, data.energy, data.energySpent],
        maxData:[25,50,50],
        time:[false, false, false]
    };
    
    chartsArray.forEach((c, i) => {
        let chart = c.data
        
        if(chart.labels.length > input.maxData[i]){
            chart.labels.splice(0,1);
            chart.datasets[0].data.splice(0,1);
        }
        
        input.time[i] ? chart.labels.push(data.time) : chart.labels.push('');
        chart.datasets[0].data.push(input.data[i])
        c.update();
    })
}

//Calculate the distance between previous GPS and current GPS
//To see if the distance is normal(< 60 meters +- per second)
function haversineFormula(data){
    
  let GPS       = data.gps;
  var R         = 6371e3;
  var a         = toRad(GPS.lat);
  var b         = toRad(GPS.lat);
  var c         = toRad(lastGPS.lat-lastGPS.lat);
  var d         = toRad(lastGPS.lng-lastGPS.lng);
  
  var a = Math.sin(c/2) * Math.sin(c/2) +
      Math.cos(a) * Math.cos(b) *
      Math.sin(d/2) * Math.sin(d/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  function toRad(Value) {
    return Value * Math.PI / 180;
  }
  
  lastGPS = GPS;

  return Math.floor( (R * c) < 60 );
}

//Display error
function animate(link, alertDiv, error){
    
    link.style.background = '#FF0000';
    errorCounter.innerHTML = error.count;
    
    setTimeout(()=>{
        
        link.style.background = '#333333';
    },1200)
    
    alertDiv.parentElement.style.opacity = '100';
    alertDiv.innerHTML = `Error at ${error.err.fullDocument.operation}`;
    
    setTimeout(()=>{
        
        alertDiv.parentElement.style.opacity = '0';
        alertDiv.innerHTML = '';
    },2400)
}

function updateSpeed(speed){
    speedOMeter.innerHTML = speed;
}

function updateCharge(charge){
    let percentage = `${Math.floor(charge)}kWh`;
    chargeCounter.innerHTML = percentage; 
}

function updateTime(time){
    lastUpdate.innerHTML = time.split(' ')[1];
}

function updateSOC(SOC){
    soc.innerHTML =  `${Math.floor(SOC)}%`;
}

function updateOdo(odo){
    total.innerHTML = Math.floor(odo);
}

function updateDistance(dod){
    distance.innerHTML = parseInt(startODO.toFixed(2) - dod);
}

function showButtons(b){
    buttonsArray.forEach((button) => {
        button.style.display = b ? 'inline' : 'none'
    });
}

function updateStatus(state){
    statusText.innerHTML = state
    statusIMG.src    = `../img/status/${state}.png`;
}

//Send error to database
function handleError(error, operation){
    var xhr = new XMLHttpRequest();
    xhr.open("GET", `/error-handler/${error}/${operation}`);
    xhr.send();
}

