const electron = require('electron');
const url = require('url');
const path = require('path');
const net = require('net');
const ejse = require('ejs-electron');

const date_format = require('date-format');
const log4js = require("log4js");
const logger = log4js.getLogger();
let d = new Date();
let loggerConfig={
	"appenders": {
		"everything": {
			"type": "file",
			"filename":"logs/"+("0" +  d.getFullYear()+ "_" + ("0"+(d.getMonth()+1)).slice(-2) + "_" +("0" + d.getDate()).slice(-2)+"_" + ("0" + d.getHours()).slice(-2) + "_" + ("0" + d.getMinutes()).slice(-2)+ "_" + ("0" + d.getSeconds()).slice(-2))+'/logger.log',
			"maxLogSize":"10M",
			"layout":{
				"type": "pattern",
				"pattern": "[%d] [%5.5p] %m"
			}
		}
	},
	"categories": {
		"default": { "appenders": [ "everything"], "level": "ALL" }
	}
}
log4js.configure(loggerConfig);


var client = new net.Socket();
var crypto = require('crypto');

const {app, BrowserWindow, Menu, ipcMain} = electron;

const ipc = require('electron').ipcRenderer
const Store = require('electron-store');
const store = new Store();

let mainWindow;

let nativeMenus = [
	{
		label: 'Help',
		submenu: [
			{
				label: 'Settings',
				click() {
						mainWindow.loadFile("settings-page.ejs");
				}
			}
		]
	},

];

let menu = Menu.buildFromTemplate(nativeMenus)
Menu.setApplicationMenu(menu)

//app ready listener
app.on('ready', function() {
    //creating new window
    mainWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        resizable: false,
		minimizable:false,
		movable:false,
		closable:false,
        webPreferences: {
			nodeIntegration: true,
			devTools: true
        }
    });
	let hmiSettings=getHMISettings()
	ejse.data('system_general_layout_no',hmiSettings['general_layout_no'])
	mainWindow.loadFile('general-view.ejs');

});
app.on('window-all-closed', () => {
	let m = {"req" : 'changeMode', "machineId" : currentConnectedMachine,'params': {'mode':0}};//force to set auto mode
	sendMessageToServer(JSON.stringify(m));
	app.quit()
})

//Processing socket processes
let previouslyConnected = 0;
let alreadyConnected = 0;
let currentConnectedMachine = 0;
/* const port = 10707;
const host = "192.168.1.102"; */
let port = store.get("adta_server_port", "not_set");
let host = store.get("adta_server_address", "not_set");
let cmAddress = store.get("adta_cm_address", "not_set");
/* const port = 50555;
const host = "192.168.0.104"; */
const timeout = 1000;
let retrying = false;
let machineList = {};
let maintenanceIpList = {};
let ipList, connectionStatus;
let unRegisteredUser={'id':0,'name':'Amazon Operator','role':0}
let currentUser=unRegisteredUser;

function logoutUser() {
	mainWindow.resizable=false;
	mainWindow.minimizable=false;
	mainWindow.movable=false;
	mainWindow.closable=false;
	let m = {"req" : 'changeMode', "machineId" : currentConnectedMachine,'params': {'mode':0}};//force to set auto mode
	sendMessageToServer(JSON.stringify(m));
	nativeMenus[0].submenu.pop();
	delete(nativeMenus[1])

	menu = Menu.buildFromTemplate(nativeMenus);
	Menu.setApplicationMenu(menu);
	currentUser=unRegisteredUser;
	mainWindow.loadFile("settings-page.ejs");
}

// Functions to handle socket events
function makeConnection () {
	if(alreadyConnected == 0) {
		//console.log(port + " - " + host);
		logger.info(new Date().toString(),":Connecting with Host="+host+" Port="+port);
		if((port != "not_set") && (host != "not_set")) {
			client.connect(port, host);
		}
	}
}


function generateIpListHtml() {
	let returnHtml = '<option value="">Select machine</option>';
	for (let k in ipList) {
		returnHtml += '<option value="'+ k +'">' + ipList[k].ip_address + '</option>';
	}
	return returnHtml;
}

function getStoredValue(key_name) {
	return store.get(key_name, "not_set");
}

function connectEventHandler() {
	//console.log('connected');
	logger.info(new Date().toString(),":Connected with JavaServer");
	alreadyConnected = 1;
	retrying = false;
	mainWindow.webContents.send("render:server_connected");

	connectionStatus = setInterval(() => {
		if(currentConnectedMachine != 0) {
			//console.log("sending device status check message");
			let m = {"req" : "getCommonStatus", "machineId" : currentConnectedMachine,'params':{}};
			sendMessageToServer(JSON.stringify(m));
		}
	}, 2000);
	sendMessageToServer(JSON.stringify({"req" : "basic_info"}));
}
let basic_info={};
function processReceivedJsonObjects(jsonObjects) {
	jsonObjects.forEach(function(jsonObj) {
		if(jsonObj.type != undefined) {
			let resType = jsonObj.type;
			if(resType == "basic_info") {
				//can split in multiple request if data loss
				basic_info=jsonObj.basic_info;
				let doors={}
				for(let key in basic_info['inputsInfo']){
					let inputInfo=basic_info['inputsInfo'][key];
					if(inputInfo['device_type']==6){
						if(!doors[inputInfo['device_number']]){
							doors[inputInfo['device_number']]={}
						}
						doors[inputInfo['device_number']][inputInfo['device_fct']]=inputInfo;
					}
				}
				basic_info['doorsInfo']=doors;
				//ip_list request removed
				if(previouslyConnected == 0) {
					previouslyConnected = 1;
					machineList = {};
					maintenanceIpList = {};
					ipList =basic_info['machinesInfo'];
					let ipListHtml = generateIpListHtml();
					for (let k in ipList) {
						machineList[k] = ipList[k]['site_name']+" "+ipList[k]['machine_name'];
						maintenanceIpList[k] = ipList[k]['maintenance_gui_ip'];
					}
					mainWindow.webContents.send("render:ip_list", ipListHtml, machineList, maintenanceIpList);
				}
			}
			else if(
				['getStatistics','getStatisticsHourly','getStatisticsMinutely','getStatisticsCounter','getStatisticsCounterLast',
					'getStatisticsBins','getStatisticsBinsHourly','getStatisticsBinsCounter',
					'getGeneralViewData','getGeneralDevicesViewData','getGeneralMotorsViewData','getGeneralBinDetailsViewData',
					'getAlarmsViewData','getAlarmsHistory','getAlarmsHitList',
					'getMaintViewData','getParamsViewData','changeCurrentUserPassword','getCommonStatus','getIoOutputStates'
				].includes(resType)){
				mainWindow.webContents.send(resType, jsonObj);
			}
			else if(resType == "getLoginUser") {
				if(jsonObj['loginInfo']['status']){
					currentUser=jsonObj['loginInfo']['user'];
					if(currentUser['role']>0 && currentUser['role']<3){
						mainWindow.closable=true;
					}

					nativeMenus[0].submenu.push({
						label: 'Logout',
						click() {
							logoutUser();
						}
					});
					if(currentUser['role']==1){
						mainWindow.movable=true;
						mainWindow.minimizable=true;
						mainWindow.resizable=true;
						nativeMenus[1]={
							label: 'Dev Tools',
							click() {
								mainWindow.webContents.openDevTools();
							}
						}
					}
					menu = Menu.buildFromTemplate(nativeMenus);
					Menu.setApplicationMenu(menu);
				}
				mainWindow.webContents.send("getLoginUser", jsonObj);
			}
			////////////
			else if(resType == "mod_sort") {
				let modSortResult = jsonObj.result;
				mainWindow.webContents.send("render:mod_sort", modSortResult);
			} else if(resType == "induct") {
				let inductResult = jsonObj.result;
				mainWindow.webContents.send("render:induct", inductResult);
			}
		}
		else{
			//new version
			if(jsonObj['request'] != undefined){
				mainWindow.webContents.send(jsonObj['request'],jsonObj);
			}

		}
	});
}

let buffer = "";
const startTag="<begin>";
const endTag="</begin>";
function dataEventHandler(data) {
	buffer += data.toString(); // Add string on the end of the variable 'chunk'
	let startPos=buffer.indexOf(startTag);
	let endPos=buffer.indexOf(endTag);
	while (startPos>-1 && endPos>-1){
		if(startPos>0){
			logger.warn("[START_POS_ERROR] Message did not started with begin");
			logger.warn("[MESSAGE]"+buffer);
		}
		if(startPos>endPos){
			logger.warn("[END_POS_ERROR] End tag found before start tag.");
			logger.warn("[MESSAGE]"+buffer);
			buffer=buffer.substring(startPos);
		}
		else{
			let messageString=buffer.substring(startPos+startTag.length,endPos);
			try {
				//let jo = JSON.parse(messageString.replace(/\}\s*\{/g, '},{') )
				let jo = JSON.parse('[' + messageString.replace(/\}\s*\{/g, '},{') + ']')
				processReceivedJsonObjects(jo);
			}
			catch (er) {
				console.log("Failed to convert Json");
				logger.error("[INVALID_DATA] "+messageString)
			}
			buffer=buffer.substring(endPos+endTag.length);
		}
		startPos=buffer.indexOf(startTag);
		endPos=buffer.indexOf(endTag);
	}
}

function endEventHandler() {
    console.log('end');
}

function timeoutEventHandler() {
    // console.log('timeout');
}

function drainEventHandler() {
    // console.log('drain');
}

function errorEventHandler(err) {
	console.log(new Date().toString(),err.toString());
	// console.log('error');
	// console.log(err);
}

function closeEventHandler () {
	if(alreadyConnected==1){
		logger.error(new Date().toString(),":Disconnected from JavaServer. Host="+host+" Port="+port);
	}
	//have to handle it
	mainWindow.webContents.send("render:server_disconnected");
	// console.log('close');
	clearInterval(connectionStatus);
	alreadyConnected = 0;
    if (!retrying) {
        retrying = true;
        console.log('Reconnecting...');
	}
	console.log("Trying to connect");
    setTimeout(makeConnection, timeout);
}

// Create socket and bind callbacks
client.on('connect', connectEventHandler);
client.on('data',    dataEventHandler);
client.on('end',     endEventHandler);
client.on('timeout', timeoutEventHandler);
client.on('drain',   drainEventHandler);
client.on('error',   errorEventHandler);
client.on('close',   closeEventHandler);

//0 for welcome
function sendMessageToServer(msg) {
	if(alreadyConnected){
		//send message only when connected
		client.write(startTag+msg+endTag);
	}
}

ipcMain.on("connect:server", function(e) {
	makeConnection();
});

ipcMain.on("get:views", function(e, machineId, view_name) {
	currentConnectedMachine = machineId;
	let data=basic_info;
	data['currentUser']=currentUser;
	data['hmiSettings']=getHMISettings();
	if(['settings'].includes(view_name)){
		mainWindow.webContents.send("render:"+view_name, basic_info);
	}
	else if(machineId!=0){
		if(['statistics','statistics-hourly','statistics-bins-detail','statistics-oee'
			,'general-view','general-view-devices','general-view-motors'
			,'alarms-view','alarms-history-view','alarms-hitlist-view',
			'token','maint','maint-devices','maint-motors','params','sorting-code-detail','statistics-shift-wise', 'maint-sort'].includes(view_name)){
			mainWindow.webContents.send("render:"+view_name, data);
		}
		else{
			let m = {"req" : view_name, "id" : machineId};
			sendMessageToServer(JSON.stringify(m));
		}
	}

});

ipcMain.on("get:change_induct", function(e, machineId, mode, inductId) {
	currentConnectedMachine = machineId;
	if((machineId != 0)) {
		let m = {"req" : "change_induct", "id" : machineId, "mode" : mode, "induct" : inductId};
		sendMessageToServer(JSON.stringify(m));
	}
});

ipcMain.on("get:mod_sort", function(e, machineId, device_type, device_number) {
	currentConnectedMachine = machineId;
	if((machineId != 0)) {
		let m = {"req" : "mod_sort", "id" : machineId, "device_type" : device_type, "device_number": device_number};
		sendMessageToServer(JSON.stringify(m));
	}
});

ipcMain.on("get:induct", function(e, machineId, induct_number) {
	currentConnectedMachine = machineId;
	if((machineId != 0)) {
		let m = {"req" : "induct", "id" : machineId, "induct_number": induct_number};
		sendMessageToServer(JSON.stringify(m));
	}
});


ipcMain.on("get:device_command", function(e, machineId, device_id, operation_id) {
	currentConnectedMachine = machineId;
	if((machineId != 0)) {
		let m = {"req" : "device_command", "id" : machineId, "device" : device_id, "operation" : operation_id};
		sendMessageToServer(JSON.stringify(m));
	}
});


ipcMain.on("get:filtered_alarm_history", function(e, machineId, start_timestamp, end_timestamp) {
	currentConnectedMachine = machineId;
	if((machineId != 0) && (start_timestamp !== "") && (end_timestamp !== "")) {
		let m = {"req" : "filtered_alarm_history", "id" : machineId, "start" : start_timestamp, "end" : end_timestamp};
		sendMessageToServer(JSON.stringify(m));
	}
});

ipcMain.on("get:filtered_alarm_hit_list", function(e, machineId, start_timestamp, end_timestamp) {
	currentConnectedMachine = machineId;
	if((machineId != 0) && (start_timestamp !== "") && (end_timestamp !== "")) {
		let m = {"req" : "filtered_alarm_hit_list", "id" : machineId, "start" : start_timestamp, "end" : end_timestamp};
		sendMessageToServer(JSON.stringify(m));
	}
});

ipcMain.on("change:link", function(e, link) {
	//console.log(link);
	let linkFile = link + ".ejs";

	mainWindow.loadFile(linkFile);
});

ipcMain.on("change:modsort", function(e, device_type, sorter_number, device_number) {
	//console.log(link);
	let linkFile = "divert.ejs";
	mainWindow.loadFile(linkFile, {query: {"device_type": device_type, "sorter_number": sorter_number, "device_number": device_number}});
});

ipcMain.on("change:induct", function(e, induct_id) {
	let linkFile = "inducts.ejs";
	mainWindow.loadFile(linkFile, {query: {"induct_number": induct_id}});
});

//called by nav.js when page loaded
ipcMain.on("page:loaded", function(e) {
	let ipListHtml = generateIpListHtml();
	mainWindow.webContents.send("link:changed", ipListHtml, machineList, currentConnectedMachine, maintenanceIpList);
});



ipcMain.handle('getSingleStoreValue', (event, key) => {
	return store.get(key, "not_set");
});

///////
function getHMISettings(){
	let project_prefix='adta_';
	return {
		"ip_address_input" : store.get(project_prefix+"server_address", "not_set")
		,"port_input" : store.get(project_prefix+"server_port", "not_set")
		,"cm_ip_address_input" :  store.get(project_prefix+"cm_address", "not_set")
		,"detailed_active_alarm" : store.get(project_prefix+"detailed_active_alarm", "0")
		,"motor_speed_unit" : store.get(project_prefix+"motor_speed_unit", "m_s")
		,"general_layout_no" : store.get(project_prefix+"general_layout_no", "2")
	};
}
ipcMain.handle('getStoreValue', (e) => {
	return getHMISettings();
});
ipcMain.on("saveSettings", function(e, settings_data) {
	let project_prefix='adta_';
	store.set(project_prefix+"server_address", settings_data['ip_address_input']);
	host = settings_data['ip_address_input'];

	store.set(project_prefix+"server_port", settings_data['port_input']);
	port = settings_data['port_input'];

	store.set(project_prefix+"cm_address", settings_data['cm_ip_address_input']);
	cmAddress = settings_data['cm_ip_address_input'];

	store.set(project_prefix+"detailed_active_alarm", settings_data['detailed_active_alarm']);
	store.set(project_prefix+"motor_speed_unit", settings_data['motor_speed_unit']);
	store.set(project_prefix+"general_layout_no", settings_data['general_layout_no']);
	ejse.data('system_general_layout_no',settings_data['general_layout_no'])
});

ipcMain.handle('getCurrentUser', (event, key) => {
	return currentUser;
});
ipcMain.on("sendRequest", function(e,machineId,requestName,params) {
	if(requestName=='logoutUser'){
		logoutUser();
	}
	else if(requestName=='getSettingsViewData'){
		mainWindow.webContents.send("getSettingsViewData", {'connected':alreadyConnected});
	}
	else if(machineId>0){
		let m = {"req" : requestName, "machineId" : machineId,'params':params};
		sendMessageToServer(JSON.stringify(m));
	}
});
ipcMain.on("render:general-view-bin-details", function(e,machineId,key) {
	if(machineId>0){

		if(basic_info['binsInfo'][key]){
			//console.log(basic_info['binInfo']);
			let bin_info=basic_info['binsInfo'][key];
			let bin_inputs={};
			for(let input_key in basic_info['inputsInfo']){
				if((basic_info['inputsInfo'][input_key]['input_type']==0)
					&&(basic_info['inputsInfo'][input_key]['device_type']==4)
					&&(basic_info['inputsInfo'][input_key]['gui_input_id']>0)
					&& (basic_info['inputsInfo'][input_key]['device_number']==bin_info['sort_manager_id'])){
					bin_inputs[input_key]=basic_info['inputsInfo'][input_key];
				}
			}
			let data={}
			data['binInfo']=bin_info;
			data['binInputs']=bin_inputs;
			data['currentUser']=currentUser;
			mainWindow.loadFile('general-view-bin-details.ejs').then(function (){
				mainWindow.webContents.send("render:general-view-bin-details", data);
			});
		}
	}
});
//rosi
ipcMain.on('render:statistics-bins-detail-single', function (e, data) {
	mainWindow.loadFile('statistics-bins-detail-single.ejs').then(function () {
		data['basic_info']=basic_info;
		mainWindow.webContents.send('render:statistics-bins-detail-single', data);
	});
});

//update includes
ipcMain.on("sendRequestToServer", function(e, responseName,params,requestData=[]) {
	params['machine_id']=currentConnectedMachine;
	console.log(requestData,params)
	sendMessageToServer(JSON.stringify({"req" :responseName,'params':params,"requestData":requestData}));
})