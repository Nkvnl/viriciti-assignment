var x             = 0;
var log           = document.querySelector('#log')
var socket        = io.connect();


socket.on('new message', obj => {
    showInLog(obj.data,false)
});

socket.on('new error', obj => {
    showInLog(obj.errors.err.fullDocument,true)
});

function showInLog(data, err){
    
    var div = document.getElementById("log").children;
    let i = div.length - 1;
    i > 20 ?
    div[i].scrollIntoView({behavior: "smooth"}): 0;
    
    let content = err ? 
    `<div class="row err">
        <div class="col-2">${data.time.split(' ')[1]}</div>
        <div class="col-6">ERROR ${data.error}</div>
        <div class="col-3">WHILE ${data.operation}</div>`:
        
    `<div class="row p-0" id="data">
        <div class="col-2">${data.formattedTime.split(' ')[1]}</div>
        <div class="col-2">${data.energy} kWh</div>
        <div class="col-2">${data.odo} km</div>
        <div class="col-2">${data.speed} kmh</div>
        <div class="col-2">${data.soc} %</div>
    </div>`;
    
    log.insertAdjacentHTML('beforeend',content);
}