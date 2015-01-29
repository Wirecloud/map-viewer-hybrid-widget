/* 
 * Based in OWSManager by Lorenzo Becchi (ominiverdi.org):
 *
 *
 *     Copyright (c) 2013 CoNWeT Lab., Universidad Politécnica de Madrid
 *     Copyright (c) 2013 IGN - Instituto Geográfico Nacional
 *     Centro Nacional de Información Geográfica
 *     http://www.ign.es/
 *
 *     This file is part of the GeoWidgets Project,
 *
 *     http://conwet.fi.upm.es/geowidgets
 *
 *     Licensed under the GNU General Public License, Version 3.0 (the 
 *     "License"); you may not use this file except in compliance with the 
 *     License.
 *
 *     Unless required by applicable law or agreed to in writing, software
 *     under the License is distributed in the hope that it will be useful, 
 *     but on an "AS IS" BASIS, WITHOUT ANY WARRANTY OR CONDITION,
 *     either express or implied; without even the implied warranty of
 *     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 *  
 *     See the GNU General Public License for specific language governing
 *     permissions and limitations under the License.
 *
 *     <http://www.gnu.org/licenses/gpl.txt>.
 *
 */


OpenLayers.Control.OWSManager = OpenLayers.Class(OpenLayers.Control, {
    initialize: function(mapManager, initialServers) {
        OpenLayers.Control.prototype.initialize.apply(this);

        this.TAB_LAYERS = 0;
        this.TAB_SERVERS = 1;

        this.tabsElements = [];
        this.initialServers = initialServers;

        

        this.layersData = {
            overlays: [],
            baseLayers: [],
            wiringLayers : {}
        };

        var layersDataPreference = MashupPlatform.widget.getVariable("layersData");

        if (layersDataPreference.get() != "") {
            this.layersData = JSON.parse(layersDataPreference.get());
        }

        this.numLayers = this.layersData.overlays.length + this.layersData.baseLayers.length;

        this.wmsManager = new conwet.map.WmsManager();
        this.mapManager = mapManager;
        this.gadget = this.mapManager.getGadget();
        this.selectedLayersManager = null;

    },
    setMap: function(map) {
        OpenLayers.Control.prototype.setMap.apply(this, arguments);

        var toolBar = new OpenLayers.Control.WMSToolbar(this.wmsManager, this.mapManager);
        // Add controls
        this.map.addControl(toolBar);
        toolBar.activateControl(toolBar.PAN_CONTROL);
    },
    draw: function() {
        OpenLayers.Control.prototype.draw.apply(this);

        conwet.ui.UIUtils.ignoreEvents(this.div, ["click", "dblclick", "mouseover", "mouseout"]);
        Event.observe(this.div, "mouseup", function(e) {
            if (this.mouseDown) {
                this.mouseDown = false;
                e.stop();
            }
        }.bind(this));
        Event.observe(this.div, "mousedown", function(e) {
            this.mouseDown = true;
            e.stop();
        }.bind(this));

        this.configButton = conwet.ui.UIUtils.createButton({
            "classNames": ["config_button"],
            "title": _("Config layers"),
            "onClick": function(e) {
                this.showControls(true);
            }.bind(this)
        });
        this.map.viewPortDiv.appendChild(this.configButton);

        // Header
        var controlHeader = document.createElement("div");
        $(controlHeader).addClassName("tab_header");
        this.div.appendChild(controlHeader);

        var minimizeButton = conwet.ui.UIUtils.createButton({
            "classNames": ["minimize"],
            "title": _("Minimize"),
            "onClick": function(e) {
                this.showControls(false);
            }.bind(this)
        });
        controlHeader.appendChild(minimizeButton);

        // Layers tab

        var layersButton = conwet.ui.UIUtils.createButton({
            "classNames": ["tab"],
            "value": _("Layers"),
            "onClick": function(e) {
                this.showTab(this.TAB_LAYERS);
            }.bind(this)
        });
        controlHeader.appendChild(layersButton);

        var layersContainer = document.createElement("div");
        $(layersContainer).addClassName("tab_container");
        $(layersContainer).addClassName("tab_layers");
        this.div.appendChild(layersContainer);

        this.tabsElements.push({"button": layersButton, "container": layersContainer});

        // Servers tab

        var serversButton = conwet.ui.UIUtils.createButton({
            "classNames": ["tab"],
            "value": _("Edit Services"),
            "onClick": function(e) {
                this.showTab(this.TAB_SERVERS);
            }.bind(this)
        });
        controlHeader.appendChild(serversButton);

        //Div that contains all. Is in the servers tab
        var serversContainer = document.createElement("div");
        $(serversContainer).addClassName("tab_container");
        $(serversContainer).addClassName("tab_servers");
        this.div.appendChild(serversContainer);

        this.tabsElements.push({"button": serversButton, "container": serversContainer});

        serversContainer.appendChild(document.createTextNode("WMS Server"));


        var servDiv = document.createElement("div");
        servDiv.id = "servDiv";
        servDiv.style.display = "inline";
        this.serverSelect = new StyledElements.StyledSelect();

        this.serverSelect.addEventListener('change', this._sendGetCapabilities.bind(this));
        this.serverSelect.insertInto(servDiv);

        this.serverSelect.addEntries([{label: _('- Select a server -'), value: ''}]);

        var removeButton = document.createElement('button');
        removeButton.addClassName("removeButton");
        removeButton.observe("mousedown", this.removeService.bind(this));
        removeButton.appendChild(document.createTextNode(_('X')));
        var span = document.createElement('span');
        span.title = "Remove Server";
        span.appendChild(removeButton)
        servDiv.appendChild(span);

        serversContainer.appendChild(servDiv);


        this.serverForm = document.createElement("div");
        this.serverForm.style.clear = "both";
        serversContainer.appendChild(this.serverForm);

        // Selected layers
        this.selectedLayersManager = new conwet.map.SelectedLayersManager(this.map, this.wmsManager, this.mapManager, layersContainer, this);
        //this.selectedLayersManager.addLayer(new OpenLayers.Layer.OSM("Simple OSM Map"), "EPSG:900913", true, true);

        //Google Maps base layers        
        var googleMap = new OpenLayers.Layer.Google("Google Satellite", {type: "satellite", numZoomLevels: 19});
        this.selectedLayersManager.addLayer(googleMap, "EPSG:3857", true, true);
        
        googleMap = new OpenLayers.Layer.Google("Google Hybrid", {type: "hybrid", numZoomLevels: 19});
        this.selectedLayersManager.addLayer(googleMap, "EPSG:3857", true, true);
        
        //googleMap = new OpenLayers.Layer.Google("Google Physical", {type: google.maps.MapTypeId.TERRAIN, numZoomLevels: 19});
        //this.selectedLayersManager.addLayer(googleMap, "EPSG:3857", true, true);
        
        googleMap = new OpenLayers.Layer.Google("Google Streets", {numZoomLevels: 19});
        this.selectedLayersManager.addLayer(googleMap, "EPSG:3857", true, true, true);        
       

        this.serverSelect.addEntries(this.initialServers);

        //this.preloadWmsLayer("http://www.ign.es/wms-inspire/ign-base", "IGNBaseTodo", "EPSG:4258", "image/jpeg", true, "wms");


        //TODO si no hay nada configurado
        this.showTab(this.TAB_SERVERS);
        this.showControls(false);

        this.loadSavedLayers();
        return this.div;
    },
    showControls: function(show) {
        if (show) {
            this.div.addClassName("show");
        }
        else {
            this.div.removeClassName("show");
        }
    },
    showTab: function(tab) {
        for (var i = 0; i < this.tabsElements.length; i++) {
            this.tabsElements[i].button.removeClassName('active');
            this.tabsElements[i].container.removeClassName('active');
        }

        this.tabsElements[tab].button.addClassName('active');
        this.tabsElements[tab].container.addClassName('active');
    },
    addWmsService: function(name, url) {
        var entry = {label: name, value: url}
        if (this._serverIndex(url) == -1) {
            this.serverSelect.addEntries([entry]);
            this.initialServers.push({label: name, value: url, isWmsc: false, isWmts: false});
            MashupPlatform.widget.getVariable("services").set(JSON.stringify(this.initialServers));
            this.gadget.showMessage(_("New server added."));
        } else {
            this.gadget.showMessage(_("This server already exists."));
        }

    },
    addWmscService: function(name, url) {
        var entry = {label: name, value: url}
        if (this._serverIndex(url) == -1) {
            this.serverSelect.addEntries([entry]);
            this.initialServers.push({label: name, value: url, isWmsc: true, isWmts: false});
            MashupPlatform.widget.getVariable("services").set(Object.toJSON(this.initialServers));
            this.gadget.showMessage(_("New server added."));
        } else {
            this.gadget.showMessage(_("This server already exists."));
        }

    },
    addWmtsService: function(name, url) {
        var entry = {label: name, value: url}
        if (this._serverIndex(url) == -1) {
            this.serverSelect.addEntries([entry]);
            this.initialServers.push({label: name, value: url, isWmsc: false, isWmts: true});
            MashupPlatform.widget.getVariable("services").set(JSON.stringify(this.initialServers));
            this.gadget.showMessage(_("New server added."));
        } else {
            this.gadget.showMessage(_("This server already exists."));
        }

    },
    _sendGetCapabilities: function(select) {
        var baseURL = select.getValue();
        //var isWmsc = this._isWmsc(baseURL);
        var type = this.serviceType(baseURL);

        if (this.serverForm) {
            this.serverForm.innerHTML = "";
        }

        /* if (baseURL.toLowerCase().indexOf("wmsc")!==-1 || baseURL.toLowerCase().indexOf("wms-c")!==-1){
         this.gadget.showError("This server is not WMS. WMSC and WMTS are not supported");
         return;
         }*/
        if (baseURL.length == 0) {
            return;
        }

        if (baseURL.indexOf('?') == -1) {
            baseURL = baseURL + '?';
        } else {
            if (baseURL.charAt(baseURL.length - 1) == '&')
                baseURL = baseURL.slice(0, -1);
        }

        this.gadget.showMessage(_("Requesting data from server."), true);
        if (type == "wmts"){
            baseURL += "service=WMTSC&version=1.0.0&request=GetCapabilities";
        }else{
            baseURL += "service=WMS&version=1.3.0&request=GetCapabilities";
        }

        //TODO Gif chulo para esperar
        MashupPlatform.http.makeRequest(baseURL, {
            method: 'GET',
            onSuccess: function(response) {
                this.gadget.hideMessage();
                this._parseGetCapabilities(baseURL, response, type, false);
            }.bind(this),
            onFailure: function() {
                this.gadget.showError(_("Server not responding."));
            }.bind(this)
        });
    },
    _parseGetCapabilities: function(baseURL, ajaxResponse, type, init) {
        var xml;
        if (ajaxResponse.responseXML == null) {
            var text = ajaxResponse.responseText;
            text = text.replace(/<!--.*?-->/g, '');                         // Helped with ESA server
            text = text.replace(/\[.<!.*?>.\]/g, '');                       // Helped with ESA server
            text = text.replace(/<GetTileService>.*?GetTileService>/g, ''); // Skip NASA DTD error

            if (this.type!="wmts")
                xml = this.parseDOMFromString(text, 'application/xml', true);

            if (xml == null || typeof xml != 'object')
                return this.gadget.showError('Incorrect content: check your WMS url');

            if (xml.childNodes.length == 0) {
                try {
                    if (OpenLayers.Ajax.getParseErrorText(xml) != OpenLayers.Ajax.PARSED_OK) {
                        var error = OpenLayers.Ajax.getParseErrorText(xml);
                        return this.gadget.showError("Error Parsing GetCapabilties:" + error);
                    }
                } catch (e) {
                    return this.gadget.showError(e.description);
                }
            }
        } else {
            xml = ajaxResponse.responseXML;
        }

        if (xml != null) {
            var service;
            try {
                if (type == "wmsc") {
                    service = new conwet.map.WmscService(xml);
                } else if (type == "wmts") {
                    service = new conwet.map.WmtsService(xml);
                } else {
                    service = new conwet.map.WmsService(xml);
                }
                this.wmsManager.addService(baseURL, service);
                if (!init)
                    this._drawServersForm(baseURL);
            } catch (e) {
                this.gadget.showError(_('Error: An error happened parsing the service'));
            }
        } else {
            this.gadget.showError(_('Incorrect content: check your WMS url'));
        }

    },
    _drawServersForm: function(baseURL) {
        var service = this.wmsManager.getService(baseURL);
        var type = this.serviceType(baseURL.split("?")[0]);

        // Info div
        var infoDiv = document.createElement("div");
        $(infoDiv).addClassName("layer_info");

        // Projection select
        var projectionSelect = new StyledElements.StyledSelect();

        // Image type select
        var imageFormatSelect = new StyledElements.StyledSelect();

        // Layer select
        var layerSelect = new StyledElements.StyledSelect({idFun: function(layer) {
                return layer.getName();
            }});

        //Function that shows a table with data from the WMS Service
        var showtable = function(select) {

            var layer = service.getLayer(select.getValue());
            infoDiv.innerHTML = "";

            var table = document.createElement("table");
            table.cellSpacing = 0;
            table.appendChild(this._createTableRow(_("Service"), document.createTextNode(service.getTitle())));
            table.appendChild(this._createTableRow(_("Title"), document.createTextNode(layer.getTitle())));
            table.appendChild(this._createTableRow(_("Queryable"), document.createTextNode((layer.isQueryable()) ? _("Yes") : _("No"))));
            table.appendChild(this._createTableRow(_("Name"), document.createTextNode(layer.getName())));

            if (layer.getAbstract()) {
                table.appendChild(this._createTableRow(_("Abstract"), document.createTextNode(layer.getAbstract())));
            }

            /*if (layerInfo.getLegendUrl()) {
             var img = document.createElement("img");
             img.src = layerInfo.getLegendUrl();
             table.appendChild(this._createTableRow(_("Legend"), img));
             }*/

            $(table.lastChild).addClassName("last");
            infoDiv.appendChild(table);

            projectionSelect.clear();
            imageFormatSelect.clear();
            this._addProjections(projectionSelect, layer.projections);
            this._addFormats(imageFormatSelect, layer.formats);
        }.bind(this);

        layerSelect.addEventListener('change', showtable);

        var layers = service.getLayers();
        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            if (layer.getName() != null) {
                layerSelect.addEntries([{label: layer.getTitle() + ((layer.isQueryable()) ? _(' (q)') : ''), value: layer.getName()}]);
            }
        }

        // Add projections
        var b = service.getLayer(layerSelect.getValue());
        this._addProjections(projectionSelect, b.projections);

        // Add formats
        this._addFormats(imageFormatSelect, b.formats);

        //Label containing "Projection"
        var projectionDiv = document.createElement('div');
        projectionDiv.addClassName("no_display");

        // Base layer checkbox
        var baseLayerButton = document.createElement('input');
        baseLayerButton.type = 'checkbox';
        baseLayerButton.value = 'overlay';
        baseLayerButton.checked = false;
        baseLayerButton.observe("mousedown", function(e) {
            baseLayerButton.checked = !baseLayerButton.checked;
            if (baseLayerButton.checked) {
                projectionDiv.removeClassName("no_display");
            }
            else {
                projectionDiv.addClassName("no_display");
            }
        }.bind(this));

        var baseLayerLabel = document.createElement('span');
        baseLayerLabel.addClassName("floatingText");
        baseLayerLabel.appendChild(document.createTextNode(_('Is base layer')));

        // Add button
        var addButton = document.createElement('button');
        $(addButton).observe("mousedown", function() {
            var layer = service.getLayer(layerSelect.getValue());

            var layerData = {
                serverUrl: this.serverSelect.getValue(),
                layerName: layer.layer.name,
                projection: projectionSelect.getValue(),
                imageFormat: imageFormatSelect.getValue(),
                isBaseLayer: baseLayerButton.checked,
                type: type
            };
            var list = (layerData.isBaseLayer) ? this.layersData.baseLayers : this.layersData.overlays;

            if (!this._existLayer(layerData.isBaseLayer, layerData.layerName)) {
                list.push(layerData);
                MashupPlatform.widget.getVariable("layersData").set(JSON.stringify(this.layersData));
            }

            this._addWMSLayer(
                    this.serverSelect.getValue(),
                    layer,
                    projectionSelect.getValue(),
                    imageFormatSelect.getValue(),
                    baseLayerButton.checked
                    );
        }.bind(this));
        addButton.appendChild(document.createTextNode(_('Add layer')));

        // Create UI
        this.serverForm.appendChild(document.createTextNode('Layer'));

        layerSelect.insertInto(this.serverForm);


        projectionDiv.appendChild(document.createTextNode('Projection'));

        projectionSelect.insertInto(projectionDiv);
        this.serverForm.appendChild(projectionDiv);

        this.serverForm.appendChild(document.createTextNode('Image Format'));

        imageFormatSelect.insertInto(this.serverForm);
        showtable(layerSelect);
        this.serverForm.appendChild(baseLayerButton);
        this.serverForm.appendChild(baseLayerLabel);
        this.serverForm.appendChild(addButton);
        this.serverForm.appendChild(infoDiv);
    },
    _addProjections: function(select, projections) {
        select.clear();
        var validProjections = ["EPSG:4258", "EPSG:900913", "EPSG:4326", "EPSG:4230", "EPSG:3857", "EPSG:23030", "EPSG:25830", "EPSG:32630"];
        for (var i = 0; i < projections.length; i++) {
            if (validProjections.indexOf(projections[i]) != -1) {
                select.addEntries([{label: projections[i], value: projections[i]}]);
            }
        }
    },
    _addFormats: function(select, formats) {
        select.clear();
        for (var i = 0; i < formats.length; i++) {
            select.addEntries([{label: formats[i], value: formats[i]}]);
        }
    },
    _addJSONLayer: function(json) {
        var layer = new OpenLayers.Layer.Vector();
        layer.addFeatures((new OpenLayers.Format.GeoJSON()).read(json));
        this.map.addLayer(layer);
    },
    _addWMSLayer: function(url, layer, projection, imageType, isBaseLayer, init, last, type) {

        if ((!isBaseLayer) && (imageType == 'image/jpeg'))
            return this.gadget.showError('you cannot select JPEG format for overlays, please choose another format');

        this.showTab(this.TAB_LAYERS);
        
        if (!type)
            type = this.serviceType(url.split('?')[0]);

        type=type.toLowerCase();
        this.selectedLayersManager.createLayer(url, layer, projection, imageType, isBaseLayer, init, last, type);
    },
    /*addMarkerLayer: function(layer) {
     this.selectedLayersManager.addLayer(layer, false);
     },*/

    _createTableRow: function(title, value, layer) {
        var tr = document.createElement("tr");
        var th = document.createElement("th");
        th.appendChild(document.createTextNode(title));
        tr.appendChild(th);
        var td = document.createElement("td");
        td.appendChild(value);
        tr.appendChild(td);
        return tr;
    },
    _serverIndex: function(serverUrl) {

        var index = -1;
        for (var i = 0, len = this.initialServers.length; i < len; i++) {
            if (this.initialServers[i].value === serverUrl) {
                index = i;
                break;
            }
        }
        return index;
    },
    _isWmsc: function(serverUrl) {
        var index = this._serverIndex(serverUrl);
        var isWmsc = false;

        if (index != -1) {
            if (this.initialServers[index].isWmsc)
                isWmsc = true;
        }

        return isWmsc;
    },
    serviceType: function(serverUrl) {
        var index = this._serverIndex(serverUrl);


        if (index != -1) {
            if (this.initialServers[index].isWmsc)
                return "wmsc";
            else if (this.initialServers[index].isWmts)
                return "wmts";
            else
                return "wms";
        }
        return null;
    },
    /*_preloadCapabilities: function() {
     for (var i = 0; i < this.initialServers.length; i++) {
     
     var baseURL = this.initialServers[i].value;
     var isWmsc = this._isWmsc(baseURL);
     
     
     if (this.serverForm) {
     this.serverForm.innerHTML = "";
     }
     
     if (baseURL.length == 0) {
     return;
     }
     
     if (baseURL.indexOf('?') == -1) {
     baseURL = baseURL + '?';
     } else {
     if (baseURL.charAt(baseURL.length - 1) == '&')
     baseURL = baseURL.slice(0, -1);
     }
     
     this.gadget.showMessage(_("Requesting data from server."), true);
     baseURL += "service=WMS&version=2.0&request=GetCapabilities";
     
     //TODO Gif chulo para esperar
     MashupPlatform.http.makeRequest(baseURL, {
     method: 'GET',
     onSuccess: function(response) {
     this.gadget.hideMessage();
     this._parseGetCapabilities(baseURL, response, isWmsc, true);
     }.bind(this),
     onFailure: function() {
     this.gadget.showError(_("Server not responding."));
     }.bind(this)
     });
     }
     },*/
    loadSavedLayers: function() {

        //var last = (!this.layersData.baseLayers.length);

        for (var i = 0; i < this.layersData.overlays.length; i++) {

            var layerData = this.layersData.overlays[i];
            // var isLast = last && i === (this.layersData.overlays.length-1);
            //var type = this.serviceType();

            this.preloadWmsLayer(layerData.serverUrl, layerData.layerName, layerData.projection,
                    layerData.imageFormat, layerData.isBaseLayer, layerData.type);
        }

        for (var i = 0; i < this.layersData.baseLayers.length; i++) {

            var layerData = this.layersData.baseLayers[i];

            this.preloadWmsLayer(layerData.serverUrl, layerData.layerName, layerData.projection,
                    layerData.imageFormat, layerData.isBaseLayer, //(i === this.layersData.baseLayers.length - 1));
                    layerData.type);
        }


    },
    preloadWmsLayer: function(serverUrl, layerName, projection, imageFormat, isBaseLayer, type) {
        var url = serverUrl;
        
        if (type == "wmts") 
            url += "?service=WMTS&version=1.0.0&request=GetCapabilities";
        else if (type == "wmsc")
            url += "?service=WMSC&version=1.3.0&request=GetCapabilities";        
        else
            url += "?service=WMS&version=1.3.0&request=GetCapabilities";
        
        MashupPlatform.http.makeRequest(url, {
            method: 'GET',
            onSuccess: function(response) {
                this.gadget.hideMessage();
                this._parseGetCapabilities(url, response, type, true);
                var service = this.wmsManager.getService(serverUrl);
                var layers = service.getLayers();
                var layer;

                for (var i = 0; i < layers.length; i++) {
                    if (layers[i].layer.name === layerName) {
                        layer = layers[i];
                        break;
                    }
                }
                if (layerName !== "IGNBaseTodo") {
                    this.numLayers--;
                }
                this._addWMSLayer(serverUrl, layer, projection, imageFormat, isBaseLayer, true, !(this.numLayers), type);


                if (layerName == "IGNBaseTodo") {
                    this.loadSavedLayers();
                    /*this.selectedLayersManager.deleteLayerFromState(layerName, isBaseLayer);*/
                }

            }.bind(this),
            onFailure: function() {
                if (layerName == "IGNBaseTodo")
                    this.selectedLayersManager.selectPreviousLayerAndZoom();
                this.gadget.showError(_("Server not responding."));
                this.numLayers--;
                this.selectedLayersManager.deleteLayerFromState(layerName);
            }.bind(this)
        });

    },
    addLayerFromWiring: function(id, serverUrl, layerName, projection, isBaseLayer, type) {
        if (this.layersData.wiringLayers[id]){
            this.gadget.showError(_("This layer is already displayed."))
            return;
        }

        var url = serverUrl;
        var service = this.wmsManager.getService(serverUrl);
        var imageFormat = isBaseLayer ? "image/jpeg" : "image/png";
        type= type.toLowerCase();

        if (service!=null){
            var layers = service.getLayers();
            var layer;

            for (var i = 0; i < layers.length; i++) {
                if (layers[i].layer.name === layerName) {
                    layer = layers[i];
                    break;
                }
            }

            if (id){
                this.layersData.wiringLayers[id] = layerName;

                /*var layerData = {
                    serverUrl: serverUrl,
                    layerName: layerName,
                    projection: projection,
                    imageFormat: imageFormat,
                    isBaseLayer: isBaseLayer,
                    type: type
                };
                var list = (layerData.isBaseLayer) ? this.layersData.baseLayers : this.layersData.overlays;
                list.push(layerData);
                MashupPlatform.widget.getVariable("layersData").set(JSON.stringify(this.layersData));*/
                
            }
            this._addWMSLayer(serverUrl, layer, projection, imageFormat, isBaseLayer, false, false, type);
            return;
        }
        

        
        if (type == "wmts") 
            url += "?service=WMTS&version=1.0.0&request=GetCapabilities";
        else if (type == "wmsc")
            url += "?service=WMSC&version=1.3.0&request=GetCapabilities";        
        else
            url += "?service=WMS&version=1.3.0&request=GetCapabilities";
        
        MashupPlatform.http.makeRequest(url, {
            method: 'GET',
            onSuccess: function(response) {
                this.gadget.hideMessage();
                this._parseGetCapabilities(url, response, type, true);                

                service = this.wmsManager.getService(serverUrl);
                var layers = service.getLayers();
                var layer;

                for (var i = 0; i < layers.length; i++) {
                    if (layers[i].layer.name === layerName) {
                        layer = layers[i];
                        break;
                    }
                }

                if (id){
                this.layersData.wiringLayers[id] = layerName;

                /*var layerData = {
                    serverUrl: serverUrl,
                    layerName: layerName,
                    projection: projection,
                    imageFormat: imageFormat,
                    isBaseLayer: isBaseLayer,
                    type: type
                };
                var list = (layerData.isBaseLayer) ? this.layersData.baseLayers : this.layersData.overlays;
                list.push(layerData);
                MashupPlatform.widget.getVariable("layersData").set(JSON.stringify(this.layersData));*/
                }

                this._addWMSLayer(serverUrl, layer, projection, imageFormat, isBaseLayer, false, false, type);

            }.bind(this),
            onFailure: function() {
                this.gadget.showError(_("Server not responding."));                
                this.selectedLayersManager.deleteLayerFromState(layerName);
            }.bind(this)
        });

    },
    removeLayerFromWiring: function(id){
        var layerName = this.layersData.wiringLayers[id];
        if (layerName != null){
            //this.selectedLayersManager.removeLayerWithName(layer.layer.title);
            this.selectedLayersManager.removeLayerWithName(layerName);
            delete this.layersData.wiringLayers[id];
            //MashupPlatform.widget.getVariable("layersData").set(JSON.stringify(this.layersData));
        }

    },
    selectBaseLayerFromWiring: function(id){
        var layerName = "";
        switch(id){
            case "GOOGLE_STANDARD":
                layerName = "Google Streets";
                break;
            case "GOOGLE_SATELLITE":
                layerName = "Google Satellite";
                break;
            case "GOOGLE_HYBRID":
                layerName = "Google Hybrid";
                break;
        }
        if (layerName != "")
            this.selectedLayersManager.selectBaseLayer(layerName);
    },
    removeService: function() {
        var url = this.serverSelect.getValue();
        var name = this.serverSelect.getLabel();
        if (url != '') {
            var indice = this._serverIndex(url);
            this.initialServers.splice(indice, 1);

            MashupPlatform.widget.getVariable("services").set(Object.toJSON(this.initialServers));
            this.serverSelect.clear();
            this.serverSelect.addEntries([{label: _('- Select a server -'), value: ''}]);
            this.serverSelect.addEntries(this.initialServers);
            this.serverForm.innerHTML = "";
            this.selectedLayersManager.removeService(url);
            this.gadget.showMessage(_("The server '" + name + "' and its layers have been removed."));
        }
    },
    parseDOMFromString: function(text, type, fromAjax) {
        var result, new_header, parser = new DOMParser();

        fromAjax = fromAjax !== undefined ? fromAjax : true;

        if (fromAjax) {
            // Remove encoding from the xml header as responseText is allways utf-8
            result = text.match(new RegExp('<\?xml(?:[^\/]|\/[^>])*standalone="([^"]+)"(?:[^\/]|\/[^>])*\?>'));
            if (result && (result[1] === 'yes' || result[1] === 'no')) {
                new_header = '<?xml version="1.0" standalone="' + result[1] + '" ?>';
            } else {
                new_header = '<?xml version="1.0" ?>';
            }
            text = text.replace(/<\?xml([^\/]|\/[^>])*\?>/g, new_header);
        }

        return parser.parseFromString(text, type);
    },
    deleteLayer: function(isBaseLayer, url) {
        if (isBaseLayer) {
            for (var i = 0; i < this.layersData.baseLayers.length; i++) {
                if (this.layersData.baseLayers[i].serverUrl === url.split('?')[0]) {
                    this.layersData.baseLayers.splice(i, 1);
                    break;
                }
            }
        }

        else {
            for (var i = 0; i < this.layersData.overlays.length; i++) {
                if (this.layersData.overlays[i].serverUrl === url.split('?')[0]) {
                    this.layersData.overlays.splice(i, 1);
                    break;
                }
            }
        }

        MashupPlatform.widget.getVariable("layersData").set(JSON.stringify(this.layersData));
    },
    positionUp: function(url) {

        for (var i = 0; i < this.layersData.baseLayers.length; i++) {
            if (this.layersData.overlays[i].serverUrl === url.split('?')[0]) {
                var layerData = this.layersData.overlays[i + 1];
                this.layersData.overlays[i + 1] = this.layersData.overlays[i];
                this.layersData.overlays[i] = layerData;
            }
        }

        MashupPlatform.widget.getVariable("layersData").set(JSON.stringify(this.layersData));
    },
    positionDown: function(url) {

        for (var i = 0; i < this.layersData.baseLayers.length; i++) {
            if (this.layersData.overlays[i].serverUrl === url.split('?')[0]) {
                var layerData = this.layersData.overlays[i - 1];
                this.layersData.overlays[i - 1] = this.layersData.overlays[i];
                this.layersData.overlays[i] = layerData;
            }
        }

        MashupPlatform.widget.getVariable("layersData").set(JSON.stringify(this.layersData));
    },
    _existLayer: function(isBaseLayer, layerName) {

        var list = (isBaseLayer) ? this.layersData.baseLayers : this.layersData.overlays;
        for (var i = 0; i < list.length; i++) {
            if (list[i].layerName === layerName) {
                return true;
            }
        }
        return false;
    },
    /** @final @type String */
    CLASS_NAME: "OpenLayers.Control.OWSManager"

});


