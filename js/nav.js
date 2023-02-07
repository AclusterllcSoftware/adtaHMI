function correctTime(i) {
    if (i < 10) {
        i = "0" + i;
    }
    return i;
}

function startTime() {
    var today = new Date();
    var h = today.getHours();
    var m = today.getMinutes();
    var s = today.getSeconds();
    var day = today.getDate();
    var month = today.getMonth() + 1;
    var year = today.getFullYear();

    day = correctTime(day);
    month = correctTime(month);

    // add a zero in front of numbers<10
    h = correctTime(h);
    m = correctTime(m);
    s = correctTime(s);
    jQuery('#display_time').text(h + ":" + m + ":" + s);
    jQuery('#display_date').text(month + "/" + day + "/" + year);
    t = setTimeout(function() {
        startTime()
    }, 500);
}

function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}

/**
 * Returns a random integer between min (inclusive) and max (inclusive).
 * The value is no lower than min (or the next integer greater than min
 * if min isn't an integer) and no greater than max (or the next integer
 * lower than max if max isn't an integer).
 * Using Math.round() will give you a non-uniform distribution!
 */
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* function secondsToDhms(seconds) {
    seconds = Number(seconds);
    var d = Math.floor(seconds / (3600*24));
    var h = Math.floor(seconds % (3600*24) / 3600);
    var m = Math.floor(seconds % 3600 / 60);
    var s = Math.floor(seconds % 60);
    
    var parts = [];
    var dDisplay = d > 0 ? d + (d == 1 ? " day" : " days") : "";
    if(dDisplay !== "") parts.push(dDisplay);
    var hDisplay = h > 0 ? h + (h == 1 ? " hour" : " hours") : "";
    if(hDisplay !== "") parts.push(hDisplay);
    var mDisplay = m > 0 ? m + (m == 1 ? " minute" : " minutes") : "";
    if(mDisplay !== "") parts.push(mDisplay);
    var sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
    if(sDisplay !== "") parts.push(sDisplay);
    return parts.join(", ");
} */

function secondsToDhms(seconds) {
    seconds = Number(seconds);
    var d = Math.floor(seconds / (3600*24));
    var h = Math.floor(seconds % (3600*24) / 3600);
    var m = Math.floor(seconds % 3600 / 60);
    var s = Math.floor(seconds % 60);
    
    var parts = [];
    var dDisplay = d > 0 ? d + "d" : "";
    if(dDisplay !== "") parts.push(dDisplay);
    var hDisplay = h > 0 ? h + "h" : "";
    if(hDisplay !== "") parts.push(hDisplay);
    var mDisplay = m > 0 ? m + "m" : "";
    if(mDisplay !== "") parts.push(mDisplay);
    var sDisplay = s > 0 ? s + "s" : "";
    if(sDisplay !== "") parts.push(sDisplay);
    var returnDhms = parts.join(" ");

    if(returnDhms === "") returnDhms = "0s";

    return returnDhms;
}

function timeConverter(UNIX_timestamp){
    var a = new Date(UNIX_timestamp * 1000);
    var months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
    var year = a.getFullYear();
    var month = months[a.getMonth()];
    var date = a.getDate() < 10 ? '0' + a.getDate() : a.getDate();
    var hour = a.getHours() < 10 ? '0' + a.getHours() : a.getHours();
    var min = a.getMinutes() < 10 ? '0' + a.getMinutes() : a.getMinutes();
    var sec = a.getSeconds() < 10 ? '0' + a.getSeconds() : a.getSeconds();
    //var hour = a.getHours();
    //var min = a.getMinutes();
    //var sec = a.getSeconds();
    //var time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
    var time = month + '-' + date + '-' + year + ' ' + hour + ':' + min + ':' + sec ;
    return time;
}

function getIPAddress() {
    var interfaces = require('os').networkInterfaces();
    for (var devName in interfaces) {
        var iface = interfaces[devName];

        for (var i = 0; i < iface.length; i++) {
            var alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal)
                return alias.address;
        }
    }

    return '0.0.0.0';
}

function changeMachineNameBg(mode) {
    if(mode === 1) {
        jQuery("#display_machine_name").removeClass("machine-mode-zero").addClass("machine-mode-one");
    } else if(mode === 0) {
        jQuery("#display_machine_name").removeClass("machine-mode-one").addClass("machine-mode-zero");
    }
}

let harcoded_cm_ip_address = 0;
async function loadCMAddress() {
    let settings_values = await ipcRenderer.invoke('getStoreValue');

    harcoded_cm_ip_address = settings_values['cm_ip_address_input'];
    //console.log(settings_values);
}

const electron = require('electron');
const {ipcRenderer} = electron;
let machine_list = {};
let maintenance_ip_list = {};
let selected_machine = 0;
let logged_in_user = "";

jQuery(document).ready(function() {
    ipcRenderer.send("page:loaded");
    loadCMAddress();
    startTime();
    
    jQuery("a.nav-link").click(function() {
        let link = jQuery(this).data("link");
        ipcRenderer.send("change:link", link);
        return false;
    });

    jQuery("a.statistics_btn").click( function() {
        let link = jQuery(this).data("link");
        ipcRenderer.send("change:link", link);
        return false;
    });
});

ipcRenderer.on("render:ip_list", function(e, ip_list_html, machine_list_from_server, maintenance_ip_list_from_server) {
    //console.log("IP List rendered : " + harcoded_cm_ip_address);
    jQuery("#ip_list_dropdown").html(ip_list_html);
    machine_list = machine_list_from_server;
    maintenance_ip_list = maintenance_ip_list_from_server;

    if(harcoded_cm_ip_address != 0 || harcoded_cm_ip_address !== "not_set") {
        jQuery("#ip_list_dropdown > option").each(function() {
            if(this.text === harcoded_cm_ip_address) {
                jQuery("#ip_list_dropdown > option").removeAttr("selected");
                let cmip_matched_value = jQuery(this).attr("value");
                jQuery("#ip_list_dropdown").val(cmip_matched_value).trigger("change");
            }
        });
    }
});

ipcRenderer.on("render:server_connected", function(e) {
    jQuery("#status-circle").css("color", "#32CD32");
});

ipcRenderer.on("render:server_disconnected", function(e) {
    jQuery("#status-circle").css("color", "#FF0000");
    //jQuery("#status-circle").css("color", "#000000");
});

ipcRenderer.on("render:device_status", function(e, device_status_result) {
    let device_disconneted = device_status_result['total'];
    device_disconneted = Number(device_disconneted);
    if(device_disconneted != 0) {
        jQuery("#status-circle").css("color", "#FFBF00");
        //jQuery("#status-circle").css("color", "#0000FF");
    } else {
        jQuery("#status-circle").css("color", "#32CD32");
    }
});

ipcRenderer.on("link:changed", function(e, ip_list_html, machine_list_from_server, selected_machine_from_server, maintenance_ip_list_from_server, user_name) {
    //console.log(machine_list_from_server);
    //console.log(selected_machine_from_server);
    if(!jQuery.isEmptyObject(machine_list_from_server)) {
        selected_machine = selected_machine_from_server;
        machine_list = machine_list_from_server;
        //logged_in_user = user_name;
        jQuery("#show-username").text(user_name);
        maintenance_ip_list = maintenance_ip_list_from_server;
        jQuery("#ip_list_dropdown").html(ip_list_html);

        if(selected_machine != 0) {
            jQuery("#ip_list_dropdown").val(selected_machine_from_server).trigger("change");
        } else {
            jQuery("#display_machine_name").text("Select a machine");    
        }
    } else {
        jQuery("#show-username").text("BlueCrest Supervisor");
        ipcRenderer.send("connect:server");
        jQuery("#display_machine_name").text("Select a machine");
    }
});