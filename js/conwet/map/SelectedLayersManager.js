/*
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

use("conwet.map");

conwet.map.SelectedLayersManager = Class.create({
    initialize: function(map, wmsManager, mapManager, parentElement, owsManager) {
        this.map = map;
        this.parentElement = parentElement;
        this.wmsManager = wmsManager;
        this.mapManager = mapManager;
        this.gadget = this.mapManager.getGadget();
        this.owsManager = owsManager;

        this.MAX_OPACITY = 1.0;
        this.MIN_OPACITY = 0.1;

        this.baseLayers = [];
        this.overlays = [];

        /* State containing what baseLayer is selected and what overlays
         * are selected. Is an array of indexes and an index related to
         * this.baselayers and this.overlays
         */
        this.state = {
            overlays: {},
            baseLayer: null
        };

        //Persistence
        var statePreference = MashupPlatform.widget.getVariable("state");

        if (statePreference.get() != "") {
            this.state = JSON.parse(statePreference.get());
        }

        this.baseLayersContainer = null;
        this.overlaysContainer = null;
        this.detailsContainer = null;

        this._draw();
    },
    _draw: function() {
        var baseLayersElement = document.createElement("div");
        $(baseLayersElement).addClassName("baselayers");
        this.parentElement.appendChild(baseLayersElement);

        var baseLayersHeader = document.createElement("div");
        $(baseLayersHeader).addClassName("header");
        baseLayersHeader.appendChild(document.createTextNode(_("Base Layers")));
        baseLayersElement.appendChild(baseLayersHeader);

        this.baseLayersContainer = document.createElement("div");
        $(this.baseLayersContainer).addClassName("container");
        baseLayersElement.appendChild(this.baseLayersContainer);

        var overlaysElement = document.createElement("div");
        $(overlaysElement).addClassName("overlays");
        this.parentElement.appendChild(overlaysElement);

        var overlaysHeader = document.createElement("div");
        $(overlaysHeader).addClassName("header");
        overlaysHeader.appendChild(document.createTextNode(_("Overlays")));
        overlaysElement.appendChild(overlaysHeader);

        this.overlaysContainer = document.createElement("div");
        $(this.overlaysContainer).addClassName("container");
        overlaysElement.appendChild(this.overlaysContainer);

        this.detailsContainer = document.createElement("div");
        $(this.detailsContainer).addClassName("details");
        this.parentElement.appendChild(this.detailsContainer);
    },
    addLayer: function(layer, projection, isBaseLayer, init, last) {
        var layerObj = null;
        var list = (isBaseLayer) ? this.baseLayers : this.overlays;
        var index = this._getLayerIndex(layer, isBaseLayer);
        var isOsm = (layer.CLASS_NAME == "OpenLayers.Layer.OSM");
        var isGoogle = (layer.CLASS_NAME == "OpenLayers.Layer.Google")

        if (index < 0) {
            var layerInfo = null;
            if (isOsm) {
                layerInfo = new conwet.map.OsmLayer(layer);
            }
            else if (isGoogle) {
                layerInfo = new conwet.map.GoogleLayer(layer);
            }
            else {
                var service = this.wmsManager.getService(layer.url);
                layerInfo = service.getLayer(layer.name);
            }

            var layerElement = document.createElement("div");
            $(layerElement).addClassName("layer");

            layerElement.observe("click", function(e) {
                this._selectLayerObj(layerObj, isBaseLayer);
            }.bind(this));

            layerElement.observe("mouseover", function(e) {
                layerElement.addClassName("highlight");
            }.bind(this), false);

            layerElement.observe("mouseout", function(e) {
                layerElement.removeClassName("highlight");
            }.bind(this), false);

            var zoomButton = document.createElement("div");
            $(zoomButton).addClassName('layer_button');
            $(zoomButton).addClassName('zoom');
            zoomButton.observe("click", function(e) {
                this._zoomToLayerExtent(layerObj.layerInfo);
            }.bind(this));
            zoomButton.title = _('Zoom to extent');

            var inputElement = document.createElement("input");
            if (isBaseLayer) {
                inputElement.name = "baseLayer";
                inputElement.type = "radio";
            }
            else {
                inputElement.type = "checkbox";
            }

            var resolutions = null;
            if (layer.params != null) {
                resolutions = layer.params.RESOLUTIONS;
            }

            var scales = null;
            if (layer.matrixIds) {
                scales = [];
                for (var i = 0; i < layer.matrixIds.length; i++) {
                    scales[i] = layer.matrixIds[i].scaleDenominator;
                }
            }

            layerObj = {
                layer: layer,
                layerElement: layerElement,
                inputElement: inputElement,
                zoomElement: zoomButton,
                layerInfo: layerInfo,
                projection: projection,
                resolutions: resolutions,
                scales: scales
            };

            inputElement.observe("mousedown", function(e) {
                if (inputElement.disabled == false) {
                    if (inputElement.type == "radio") {
                        this._changeBaseLayer(layerObj);
                    } else {
                        layerObj.inputElement.checked = (!layerObj.inputElement.checked);
                    }
                    this._saveState();
                    this._disableOverlays();
                }
                e.stop();
            }.bind(this));

            layerElement.appendChild(inputElement);

            var nameElement = document.createElement("span");
            nameElement.appendChild(document.createTextNode(layerInfo.getTitle() + ((layerInfo.isQueryable()) ? _(" (q)") : "")));
            nameElement.title = layerInfo.getTitle();
            layerElement.appendChild(nameElement);

            if (!isOsm && !isGoogle) {
                var dropButton = document.createElement("div");
                $(dropButton).addClassName('layer_button');
                $(dropButton).addClassName('drop');
                dropButton.observe("click", function(e) {
                    var index = this.map.getLayerIndex(layerObj.layer);
                    this.owsManager.deleteLayer(isBaseLayer, layerObj.layer.url);
                    this._dropLayerObj(layerObj, isBaseLayer);
                    if (isBaseLayer && (!layerObj.layerElement.hasClassName("deselected_baselayer"))) {
                        this.selectPreviousLayer();
                    }

                    this.map.removeLayer(layerObj.layer);
                    this._saveState();
                }.bind(this));
                dropButton.title = _("Remove layer");
                layerElement.appendChild(dropButton);
            }

            layerElement.appendChild(zoomButton);

            var parentElement = null;
            if (isBaseLayer) {
                parentElement = this.baseLayersContainer;
            }
            else {
                var upButton = document.createElement("div");
                $(upButton).addClassName('layer_button');
                $(upButton).addClassName("up");
                upButton.observe("click", function(e) {
                    var index = this.state.overlays[layerObj.layer.name].listIndex;
                    /*var nLayers = this.map.getNumLayers();
                     var nBases = this._getNumBaseLayers();
                     var nMarkers = this.mapManager.getNumMarkerLayers();*/

                    if (index >= this._getNumOverlays() - 1)
                        return;

                    this.map.raiseLayer(layerObj.layer, 1);
                    /*index = this.map.getLayerIndex(layerObj.layer);*/
                    //var pos = this.state.overlays[layerObj.layer.name].listIndex;
                    this._swapPos(index + 1, index, this.overlays);
                    var parentElement = layerObj.layerElement.parentNode;
                    this._saveState();
                    var previousElement = parentElement.children[parentElement.children.length - index - 2];
                    layerObj.layerElement.remove();
                    parentElement.insertBefore(layerObj.layerElement, previousElement);
                    layerObj.layerElement.removeClassName("highlight");
                    //this.owsManager.positionUp(layerObj.url);

                }.bind(this));
                upButton.title = _("Up");
                layerElement.appendChild(upButton);

                var downButton = document.createElement("div");
                $(downButton).addClassName('layer_button');
                $(downButton).addClassName("down");
                downButton.observe("click", function(e) {
                    var index = this.state.overlays[layerObj.layer.name].listIndex;
                    /*var nLayers = this.map.getNumLayers();
                     var nBases = this._getNumBaseLayers();
                     var nMarkers = this.mapManager.getNumMarkerLayers();*/

                    if (index <= 0)
                        return;

                    this.map.raiseLayer(layerObj.layer, -1);


                    this._swapPos(index - 1, index, this.overlays);
                    this._saveState();
                    var parentElement = layerObj.layerElement.parentNode;
                    if (index > 0) {
                        var nextElement = parentElement.children[parentElement.children.length - index + 1];
                        layerObj.layerElement.remove();
                        parentElement.insertBefore(layerObj.layerElement, nextElement);
                    }
                    else {
                        layerObj.layerElement.remove();
                        parentElement.appendChild(layerObj.layerElement);
                    }

                    layerObj.layerElement.removeClassName("highlight");
                    //this.owsManager.positionDown(layerObj.url);                    
                }.bind(this));
                downButton.title = _("Down");
                layerElement.appendChild(downButton);

                parentElement = this.overlaysContainer;
            }

            if (parentElement.firstChild) {
                parentElement.insertBefore(layerElement, parentElement.firstChild);
            }
            else {
                parentElement.appendChild(layerElement);
            }

            var isWmsc = false;
            if (isBaseLayer) {

                if (layerObj.resolutions != null) {
                    this.map.scales = null;
                    this.map.resolutions = layerObj.resolutions;
                    this.map.maxResolution = layerObj.resolutions[0];
                    this.map.minResolution = layerObj.resolutions[layerObj.resolutions.length - 1];

                    isWmsc = true;
                }


                this._changeMapProjection(layerInfo, projection, isWmsc, layerObj.scales);
            }


            layerObj.projection = this.map.projection;
            this._setExtent(layer, layerInfo, layerObj.projection, isWmsc);
            this.map.addLayer(layer);

            if (isBaseLayer) {
                this.map.setLayerIndex(layer, 0);
                this.map.setBaseLayer(layer, true);
                this._selectBaseLayerElement(layerObj.layerElement);
                this._updateOverlaysProjection(layerObj.projection);
                this.map.events.triggerEvent("changebaselayer");
                if (!init || last)
                    layerObj.inputElement.checked = true;
            }
            else {
                this.map.setLayerIndex(layer, this.map.getNumLayers() - this.mapManager.getNumMarkerLayers() - 1);
                layerObj.inputElement.checked = true;
            }

            list.push(layerObj);

            this._disableOverlays();

            if (!init)
                this.gadget.showMessage((isBaseLayer) ? _("New base layer added.") : _("New overlay layer added."));

            this._selectLayerObj(layerObj, isBaseLayer);
            if (last && init) {
                this._loadState();
            }

            if (!init)
                this._saveState();

            if (isBaseLayer && (!init || last)) {
                //this._zoomToExtent();
                setTimeout(function() {

                    this._zoomToLayerExtent(layerObj.layerInfo);
                    //console.log(layerObj.layer.url);
                    setTimeout(function() {
                        if (last)
                            this.gadget.stopInit();

                    }.bind(this), 1000);

                }.bind(this), 100);
            }
            else if (last) {
                setTimeout(function() {
                    this.gadget.stopInit();

                }.bind(this), 1000);
            }
        }
        else {
            layerObj = list[index];
            if (!init)
                this.gadget.showMessage(_("The layer already exist."));
        }


    },
    _setExtent: function(layer, layerInfo, projection, isWmsc) {

        // layer.maxExtent = layerInfo.getExtent(layer.projection, projection);
        layer.projection = projection;
        layer.units = new OpenLayers.Projection(projection).getUnits();
        if (isWmsc) {
            layer.maxExtent = layerInfo.getMaxExtent(projection);
            //layer.maxExtext = layerInfo.getExtent(projection);
        } else
            layer.maxExtext = layerInfo.getExtent(projection);
    },
    _changeBaseLayer: function(layerObj) {

        layerObj.inputElement.checked = true;
        var newcenter;
        //var oldproj = this.map.projection;
        var oldZoom = this.map.getZoom();
        var isWmsc = false;
        if (layerObj.resolutions != null) {
            isWmsc = true;
            this.map.scales = null;
            this.map.resolutions = layerObj.resolutions;
            this.map.maxResolution = layerObj.resolutions[0];
            this.map.minResolution = layerObj.resolutions[layerObj.resolutions.length - 1];
        }

        if (this.map.projection != layerObj.projection) {
            newcenter = this._changeMapProjection(layerObj.layerInfo, layerObj.projection, isWmsc, layerObj.scales);
        }
        this.gadget.setReactingToWiring(true);
        this.map.setBaseLayer(layerObj.layer, true);
        this._selectBaseLayerElement(layerObj.layerElement);
        if (newcenter) {

            this._zoomToExtent();
            this.map.setCenter(newcenter, oldZoom);

        }
        this.gadget.setReactingToWiring(false);
        this._updateOverlaysProjection(this.map.projection);
        this._disableOverlays();
        this.map.events.triggerEvent("changebaselayer");

    },
    _getNumBaseLayers: function() {
        return this.baseLayers.length;
    },
    _getNumOverlays: function() {
        return this.overlays.length;
    },
    _selectBaseLayerElement: function(baselayerElement) {
        for (var i = 0; i < this.baseLayers.length; i++) {
            this.baseLayers[i].layerElement.addClassName("deselected_baselayer");
        }

        baselayerElement.removeClassName("deselected_baselayer");
    },
    _updateOverlaysProjection: function(projection) {
        for (var i = 0; i < this.overlays.length; i++) {
            var layerObj = this.overlays[i];
            var layer = layerObj.layer;

            if (layerObj.projection != projection ) {
                var index = this.map.getLayerIndex(layer);
                var newLayer;
                if (layerObj.scales && layerObj.layerInfo.tileMatrixSets[projection] ) {
                    newLayer = new OpenLayers.Layer.WMTS({
                        url: layer.url,
                        layer: layerObj.layerInfo.layer.identifier,
                        name: layerObj.layerInfo.layer.identifier,
                        format: layerObj.layerInfo.format,
                        TRANSPARENT: true,
                        //EXCEPTIONS: 'application/vnd.ogc.se_inimage',
                        projection: new OpenLayers.Projection(projection),
                        isBaseLayer: false,
                        matrixIds: layerObj.layerInfo.tileMatrixSets[projection].matrixIds,
                        matrixSet: projection,
                        style: "default"});
                                    layerObj.projection = projection;
                layerObj.layer = newLayer;

                this.map.removeLayer(layer);
                this._setExtent(newLayer, layerObj.layerInfo, layerObj.projection, false);
                this.map.addLayer(newLayer);
                this.map.setLayerIndex(newLayer, index);

                } else if (!layerObj.scales){

                    newLayer = new OpenLayers.Layer.WMS(layer.name, layer.url, {
                        "layers": layer.params.LAYERS,
                        "format": layer.params.FORMAT,
                        "TRANSPARENT": "TRUE",
                        "EXCEPTIONS": "application/vnd.ogc.se_inimage",
                        projection: new OpenLayers.Projection(this.map.projection)
                    });
                                    layerObj.projection = projection;
                layerObj.layer = newLayer;

                this.map.removeLayer(layer);
                this._setExtent(newLayer, layerObj.layerInfo, layerObj.projection, false);
                this.map.addLayer(newLayer);
                this.map.setLayerIndex(newLayer, index);
                }


            }
        }
    },
    _zoomToExtent: function() {
        //this.map.zoomToExtent(layerInfo.getMaxExtent());
        this.map.zoomToExtent(this.map.maxExtent);
    },
    _zoomToLayerExtent: function(layerInfo) {
        this.map.zoomToExtent(layerInfo.getExtent(this.map.projection, true));
    },
    _disableOverlays: function(projection) {
        for (var i = 0; i < this.overlays.length; i++) {
            var layerObj = this.overlays[i];
            if (layerObj.resolutions == null) {

                if (layerObj.layerInfo.projections.indexOf(this.map.projection) !== -1) {
                    var index = this.map.getLayerIndex(layerObj.layer);

                    if (index < 0) {
                        this.map.addLayer(layerObj.layer);
                    }

                    layerObj.layerElement.removeClassName("disabled_layer");
                    layerObj.inputElement.disabled = false;
                    layerObj.layer.setVisibility(layerObj.inputElement.checked);

                }
                else {
                    var index = this.map.getLayerIndex(layerObj.layer);

                    if (index > 0) {
                        //this.map.removeLayer(layerObj.layer);
                    }

                    layerObj.layerElement.addClassName("disabled_layer");
                    layerObj.inputElement.disabled = true;
                    //layerObj.inputElement.checked = false;
                    layerObj.layer.setVisibility(false);
                }
            }
        }
    },
    /*_disableOverlays: function() {
     for (var i = 0; i < this.overlays.length; i++) {
     var layerObj = this.overlays[i];
     
     if (layerObj.layerInfo.projections.indexOf(this.map.projection) !== -1) {
     var index = this.map.getLayerIndex(layerObj.layer);
     
     if (index < 0 && layerObj.inputElement.checked) {
     this.map.addLayer(layerObj.layer);
     }else if (index > 0 && !layerObj.inputElement.checked){
     this.map.removeLayer(layerObj.layer);
     }                
     
     layerObj.layerElement.removeClassName("disabled_layer");
     layerObj.inputElement.disabled = false;
     //layerObj.layer.setVisibility(layerObj.inputElement.checked, true);
     
     }
     else {
     var index = this.map.getLayerIndex(layerObj.layer);
     
     if (index > 0) {
     this.map.removeLayer(layerObj.layer);
     }
     
     layerObj.layerElement.addClassName("disabled_layer");
     layerObj.inputElement.disabled = true;
     layerObj.inputElement.checked = false;
     //layerObj.layer.setVisibility(false, true);
     }
     }
     },*/
    _changeMapProjection: function(layerInfo, projection, isWmsc, scales) {

        this.map.units = new OpenLayers.Projection(projection).getUnits();
        var newcenter;

        var transformer = new conwet.map.ProjectionTransformer();
        if (this.map.getCenter() != null)
            newcenter = transformer.advancedTransform(this.map.getCenter(), this.map.projection, projection);
        else
            newcenter = new OpenLayers.LonLat(0, 0);

        if (!isWmsc) {
            this.map.resolutions = null;
            this.map.maxResolution = null;
            this.map.minResolution = null;

            //if (!scales) {
            scales = [Proj4js.maxScale[(this.map.units in (Proj4js.maxScale)) ? this.map.units : "m"]];

            for (var i = 0; i < 18; i++) {
                scales.push(scales[i] / 2);
            }
            //}
            this.map.scales = scales;
        }
        //this.maxResolution = "auto";
        //this.minResolution = "auto";
        if (isWmsc) {
            this.map.maxExtent = layerInfo.getMaxExtent(projection);
            //this.map.maxExtent = layerInfo.getExtent(projection);
        } else
            this.map.maxExtent = layerInfo.getExtent(projection);
        console.dir(layerInfo);
        console.log(this.map.maxExtent);

        if (this.mapManager != null)
            this.mapManager.updateMarkers(this.map.projection, projection);

        this.map.projection = projection;
        return newcenter;
    },
    _selectLayerObj: function(layerObj, isBaseLayer) {
        this._deselectAllLayers();

        layerObj.layerElement.addClassName("selected");
        this._showDetails(layerObj, isBaseLayer);
    },
    _dropLayerObj: function(layerObj, isBaseLayer) {
        var index = this._getLayerIndex(layerObj.layer, isBaseLayer);
        if (index < 0)
            return;

        var list = (isBaseLayer) ? this.baseLayers : this.overlays;
        list.splice(index, 1);

        if (layerObj.layerElement.hasClassName("selected")) {
            this._clearDetails();
        }

        layerObj.layerElement.remove();
    },
    _deselectAllLayers: function() {
        for (var i = 0; i < this.baseLayers.length; i++) {
            this.baseLayers[i].layerElement.removeClassName("selected");
        }

        for (var i = 0; i < this.overlays.length; i++) {
            this.overlays[i].layerElement.removeClassName("selected");
        }
    },
    _getLayerIndex: function(layer, isBaseLayer) {
        var list = (isBaseLayer) ? this.baseLayers : this.overlays;

        for (var i = 0; i < list.length; i++) {
            if ((list[i].layer.name == layer.name) && (list[i].layer.service == layer.service))
                return i;
        }
        return -1;
    },
    _showDetails: function(layerObj, isBaseLayer) {
        this._clearDetails();

        var table = document.createElement("table");
        table.cellSpacing = 0;

        var layerInfo = layerObj.layerInfo;
        var layer = layerObj.layer;

        if (layer.CLASS_NAME != "OpenLayers.Layer.OSM" && layer.CLASS_NAME != "OpenLayers.Layer.Google") {
            var service = this.wmsManager.getService(layer.url);
            table.appendChild(this._createTableRow(_("Service"), document.createTextNode(service.getTitle())));
        }

        table.appendChild(this._createTableRow(_("Title"), document.createTextNode(layerInfo.getTitle())));

        if (!isBaseLayer) {
            var upButton = document.createElement("div");
            $(upButton).addClassName("opacity_button");
            $(upButton).addClassName("up");
            upButton.observe("click", function(e) {
                var opacity = (layer.opacity) ? layer.opacity : 1;
                var newOpacity = Math.min(this.MAX_OPACITY, Math.max(this.MIN_OPACITY, (parseFloat(opacity) + 0.1).toFixed(1)));
                layer.setOpacity(newOpacity);
                opSpan.innerHTML = newOpacity;
                e.stop();
            }.bind(this));
            upButton.title = _("Plus");

            var opSpan = document.createElement("span");
            opSpan.innerHTML = (layer.opacity) ? layer.opacity : 1;

            var downButton = document.createElement("div");
            $(downButton).addClassName("opacity_button");
            $(downButton).addClassName("down");
            downButton.observe("click", function(e) {
                var opacity = (layer.opacity) ? layer.opacity : 1;
                var newOpacity = Math.min(this.MAX_OPACITY, Math.max(this.MIN_OPACITY, (parseFloat(opacity) - 0.1).toFixed(1)));
                layer.setOpacity(newOpacity);
                opSpan.innerHTML = newOpacity;
                e.stop();
            }.bind(this));
            downButton.title = _("Minus");

            var op = document.createElement("span");
            $(op).addClassName("opacity");

            op.appendChild(downButton);
            op.appendChild(opSpan);
            op.appendChild(upButton);

            table.appendChild(this._createTableRow(_("Opacity"), op));
        }
        else {
            table.appendChild(this._createTableRow(_("Projection"), document.createTextNode(layerObj.projection)));
        }

        table.appendChild(this._createTableRow(_("Queryable"), document.createTextNode((layerInfo.isQueryable()) ? _("Yes") : _("No"))));
        table.appendChild(this._createTableRow(_("Name"), document.createTextNode(layerInfo.getName())));

        if (layerInfo.getAbstract()) {
            table.appendChild(this._createTableRow(_("Abstract"), document.createTextNode(layerInfo.getAbstract())));
        }

        /*if (layerInfo.getLegendUrl()) {
            var url = {url:layerInfo.getLegendUrl()};
            
            this.gadget.legendUrl.send(JSON.stringify(url));
            //var img = document.createElement("img");
            //img.src = layerInfo.getLegendUrl();
            //table.appendChild(this._createTableRow(_("Legend"), img));
        }*/

        $(table.lastChild).addClassName("last");

        this.detailsContainer.appendChild(table);
    },
    _clearDetails: function() {
        this.detailsContainer.innerHTML = "";
    },
    _createTableRow: function(title, value) {
        var tr = document.createElement("tr");
        var th = document.createElement("th");
        th.appendChild(document.createTextNode(title));
        tr.appendChild(th);
        var td = document.createElement("td");
        td.appendChild(value);
        tr.appendChild(td);
        return tr;
    },
    createLayer: function(url, layer, projection, imageType, isBaseLayer, init, last, type) {
        if (url.indexOf('?') == -1) {
            url = url + '?';
        } else {
            if (url.charAt(url.length - 1) == '&')
                url = url.slice(0, -1);
        }

        if (type == "wms") {
            this.addLayer(new OpenLayers.Layer.WMS(layer.layer.name, url, {
                layers: layer.layer.name,
                format: imageType,
                TRANSPARENT: ("" + !isBaseLayer).toUpperCase(),
                //EXCEPTIONS: 'application/vnd.ogc.se_inimage',
                projection: new OpenLayers.Projection(projection),
            }), projection, isBaseLayer, init, last);

        } else if (type == "wmsc") {
            var resolutions;
            if (typeof layer.resolutions.get == 'function') {
                resolutions = layer.resolutions.get(projection + imageType);
            }
            else {
                layer.resolutions = $H(layer.resolutions);
                resolutions = layer.resolutions.get(projection + imageType);
            }
            this.addLayer(new OpenLayers.Layer.WMS(layer.layer.name, url, {
                layers: layer.layer.name,
                format: imageType,
                TRANSPARENT: ("" + !isBaseLayer).toUpperCase(),
                //EXCEPTIONS: 'application/vnd.ogc.se_inimage',
                projection: new OpenLayers.Projection(projection),
                serverResolutions: resolutions,
                resolutions: resolutions,
                isBaseLayer: isBaseLayer,
                tiled: true
            }), projection, isBaseLayer, init, last);
        } else if (type == "wmts") {
            this.addLayer(new OpenLayers.Layer.WMTS({
                url: url,
                layer: layer.layer.identifier,
                name: layer.layer.identifier,
                format: imageType,
                TRANSPARENT: ("" + !isBaseLayer).toUpperCase(),
                //EXCEPTIONS: 'application/vnd.ogc.se_inimage',
                projection: new OpenLayers.Projection(projection),
                isBaseLayer: isBaseLayer,
                matrixIds: layer.tileMatrixSets[projection].matrixIds,
                matrixSet: projection,
                style: "default"

            }), projection, isBaseLayer, init, last);
        }

    },
    _loadState: function() {
        if (this.state.baseLayer != null) {
            var layerObj = this.baseLayers[this.state.baseLayer];
            if (layerObj != null) {

                this.baseLayers[this.state.baseLayer].inputElement.checked = true;
                this._changeBaseLayer(this.baseLayers[this.state.baseLayer]);
                setTimeout(function() {
                    this._zoomToExtent();
                    this._zoomToLayerExtent(layerObj.layerInfo);
                }.bind(this), 1500);
            }
        }

        for (var i = 0; i < this.overlays.length; i++) {
            var name = this.overlays[i].layer.name;

            if (this.state.overlays[name].mapIndex >= 0)
                this.map.setLayerIndex(this.overlays[i].layer, this.state.overlays[name].mapIndex);

            this.overlays[i].inputElement.checked = this.state.overlays[name].checked;
            var stateIndex = this.state.overlays[name].listIndex;

            if (stateIndex < this.overlays.length) {
                this._swapPos(i, stateIndex, this.overlays);
            }

        }
        if (this.overlays.length) {
            var parentElement = this.overlays[0].layerElement.parentNode;
            parentElement.innerHTML = "";

            for (var i = this.overlays.length; i > 0; i--) {
                parentElement.appendChild(this.overlays[i - 1].layerElement);
            }
        }
        this._updateOverlaysProjection(this.map.projection);
        this._disableOverlays();
    },
    _saveState: function() {

        for (var i = 0; i < this.baseLayers.length; i++) {
            if (this.baseLayers[i].inputElement.checked) {
                this.state.baseLayer = i;
                break;
            }
        }
        if (this.overlays.length) {
            for (var i = 0; i < this.overlays.length; i++) {
                var index = this.map.getLayerIndex(this.overlays[i].layer);
                var name = this.overlays[i].layer.name;
                this.state.overlays[name] = {
                    mapIndex: index,
                    listIndex: i,
                    checked: this.overlays[i].inputElement.checked
                };
            }

        } else {
            this.state.overlays = {};
        }

        MashupPlatform.widget.getVariable("state").set(JSON.stringify(this.state));
    },
    _swapPos: function(a, b, array) {
        if (a !== b) {
            var temp = array[a];
            array[a] = array[b];
            array[b] = temp;
        }
    },
    deleteLayerFromState: function(layerName) {
        var listIndex = this.state.overlays[layerName].listIndex;
        delete this.state.overlays[layerName];

        /*The indexes are updated. For example if we remove the layer that was
         * in the position 2, we have to decrease the indexes 3 and 4 to 2 and 3
         */

        for (var overlay in this.state.overlays) {
            if (overlay.listIndex > listIndex) {
                overlay.listIndex--;
            }
        }

        this._loadState();
    },
    removeService: function(url) {
        url = url + "?";
        var layerObj;

        for (var i = 0; i < this.overlays.length; i++) {

            if (this.overlays[i].layer.url === url) {
                layerObj = this.overlays[i];
                this.map.removeLayer(this.overlays[i].layer);
                this._dropLayerObj(this.overlays[i], false);
                this.owsManager.deleteLayer(false, layerObj.layer.url);
                i--;

            }
        }

        for (var i = 0; i < this.baseLayers.length; i++) {

            if (this.baseLayers[i].layer.url === url) {

                layerObj = this.baseLayers[i];
                this.map.removeLayer(this.baseLayers[i].layer);
                this._dropLayerObj(this.baseLayers[i], true);
                this.owsManager.deleteLayer(true, layerObj.layer.url);
                if (!layerObj.layerElement.hasClassName("deselected_baselayer")) {
                    this._changeBaseLayer(this.baseLayers[0]);
                    this._zoomToLayerExtent(this.baseLayers[0].layerInfo);
                }
                i--;

            }
        }
        this._saveState();
    },

    removeLayerWithName: function(layerName){
        var layerObj;

        for (var i = 0; i < this.overlays.length; i++) {

            if (this.overlays[i].layerInfo.layer.name === layerName) {
                layerObj = this.overlays[i];
                this.map.removeLayer(this.overlays[i].layer);
                this._dropLayerObj(this.overlays[i], false);
                break;
            }
        }

        for (var i = 0; i < this.baseLayers.length; i++) {

            if (this.baseLayers[i].layerInfo.layer.name === layerName) {

                layerObj = this.baseLayers[i];
                this.map.removeLayer(this.baseLayers[i].layer);
                this._dropLayerObj(this.baseLayers[i], true);
                if (!layerObj.layerElement.hasClassName("deselected_baselayer")) {
                    this._changeBaseLayer(this.baseLayers[0]);
                    this._zoomToLayerExtent(this.baseLayers[0].layerInfo);
                }
                break;
            }
        }  
        this._saveState();      

    },
    selectBaseLayer: function(layerName) {
        for (var i=0; i< this.baseLayers.length; i++){
            if (this.baseLayers[i].layerInfo.layer.name === layerName){
                layerObj = this.baseLayers[i];
                layerObj.inputElement.checked = true;
                this._changeBaseLayer(layerObj);
                break;
            }
        }
    },

    selectPreviousLayer: function() {
        this.baseLayers[this.baseLayers.length - 1].inputElement.checked = true;
        this._changeBaseLayer(this.baseLayers[this.baseLayers.length - 1]);
    },
    selectPreviousLayerAndZoom: function() {
        this.selectPreviousLayer();
        this._zoomToLayerExtent(this.baseLayers[this.baseLayers.length - 1].layerInfo);
    },
    removeLayer: function(layer){
        this.map.removeLayer(layer.layer)
    }

});
