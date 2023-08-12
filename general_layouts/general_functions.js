/**
 * Created by Shaiful Islam on 2023-08-02.
 */
// ---------------
/* global basic_info */
/* global ipcRenderer */
$('#switch_legend_production').change(function () {
    if ($(this).is(":checked")) {
        $('#svg_general_colors').hide();
        $('#container_production').show();
        ipcRenderer.send("sendRequestToIpcMain", "saveSettings",{'general_show_production':1});
    } else {
        $('#svg_general_colors').show();
        $('#container_production').hide();
        ipcRenderer.send("sendRequestToIpcMain", "saveSettings",{'general_show_production':0});
    }
});
async function loadSettingsShowProduction() {
    let hmiSettings = await ipcRenderer.invoke('getStoreValue');
    if(!hmiSettings['general_show_production']){
        $('#switch_legend_production').trigger('click')
    }

}