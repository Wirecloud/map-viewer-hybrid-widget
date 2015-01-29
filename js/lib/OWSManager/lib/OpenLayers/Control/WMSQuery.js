/* Copyright (c) 2006-2007 MetaCarta, Inc., published under a modified BSD license.
 * See http://svn.openlayers.org/trunk/openlayers/repository-license.txt 
 * for the full text of the license. */

/**
 * @requires OpenLayers/Control.js
 * @requires OpenLayers/Handler/Box.js
 *
 * Class: OpenLayers.Control.WMSQuery
 *
 * Inherits from:
 *  - <OpenLayers.Control>
 */


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
 *
 * Modificado por jmostazo UPM
 */
OpenLayers.Control.WMSQuery = OpenLayers.Class(OpenLayers.Control, {
    /**
     * Property: type
     * {OpenLayers.Control.TYPE}
     */
    type: OpenLayers.Control.TYPE_TOOL,
    /**
     * Property: message
     * {String} the output message for query
     */

    message: '',
    /**
     * Property: requested
     * 
     * {Int} number of appended messages
     */

    requested: 0,
    /**
     * Property: numLayers
     * 
     * {Int} number of layers queryed
     */

    numLayers: 0,
    /**
     * Method: draw
     */

    initialize: function(mapManager, wmsManager, options) {
        OpenLayers.Control.prototype.initialize.apply(this, [options]);
        this.wmsManager = wmsManager;
        this.mapManager = mapManager;
        this.gadget = this.mapManager.getGadget();

        this.handler = new OpenLayers.Handler.Click(this, {
            'click': this.onClick.bind(this)
        }, this.handlerOptions);
    },
    onClick: function(e) {
        this.WMSQuery(e.xy);
    },
    /*    draw: function() {
     this.handler = new OpenLayers.Handler.Box(this, {done: this.WMSQuery}, {keyMask: this.keyMask});
     },*/

    /**
     * Method: WMSQuery
     *
     * Parameters:
     * position - {<OpenLayers.Bounds>} or {<OpenLayers.Pixel>}
     */
    WMSQuery: function(position) {

        // TODO Poner GIF
        this.requested = 0;
        var numLayers = 0;
        var text = '';
        var queryableLayers = [];        
        var contexts = {coordinates:position, features:[]};


        for (var i = 0; i < this.map.layers.length; i++) {
            layer = this.map.layers[i];

            if (!layer.url)
                continue;

            var serviceInfo;

            if (layer.CLASS_NAME == "OpenLayers.Layer.OSM") {
                serviceInfo = this.wmsManager.getService(layer.url[0]);
            } else {
                serviceInfo = this.wmsManager.getService(layer.url);
            }

            if (!serviceInfo)
                continue;

            var layerInfo = serviceInfo.getLayer(layer.name);

            if (layer.visibility && layerInfo.isQueryable()) {
                queryableLayers.push(layer);
            }
        }

        for (var i = 0; i < queryableLayers.length; i++) {
            var layer = queryableLayers[i];

            if (!layer.url)
                continue;

            var serviceInfo;

            if (layer.CLASS_NAME == "OpenLayers.Layer.OSM") {
                serviceInfo = this.wmsManager.getService(layer.url[0]);
            } else {
                serviceInfo = this.wmsManager.getService(layer.url);
            }

            if (!serviceInfo)
                continue;

            var layerInfo = serviceInfo.getLayer(layer.name);

            var context = {
                service: layer.url.split('?')[0],
                layer: layerInfo.getTitle(),
                self: this
            };
            var version = serviceInfo.getVersion();
            var bbox = layer.map.getExtent();
            
            var proj  = layer.map.getProjection();
            
            var options = {
                REQUEST: "GetFeatureInfo",
                EXCEPTIONS: "application/vnd.ogc.se_xml",                
                INFO_FORMAT: serviceInfo.getFeatureInfoFormat(),
                LAYERS: layerInfo.getName(),
                QUERY_LAYERS: layerInfo.getName(),
                FEATURE_COUNT: 10,
                WIDTH: layer.map.size.w,
                HEIGHT: layer.map.size.h,
                VERSION: version
            }
            
            
            if (version == "1.3.0") {
                var newBox = new OpenLayers.Bounds(bbox.toArray(true));              
                
                options.BBOX = newBox.toBBOX();
                options.I = position.x;
                options.J = position.y
                options.CRS = proj;
            }
            
            else{
                
                options.BBOX = bbox.toBBOX();
                options.X = position.x;
                options.Y = position.y
                options.SRS = proj;
            }         
            
            var url = layer.getFullRequestString(options);

            MashupPlatform.http.makeRequest(url, {
                method: 'GET',
                onSuccess: function(transport) {
                    this.text = transport.responseText;
                    this.self.requested++;
                    var newContext = {
                        service: this.service,
                        layer: this.layer,
                        text : this.text
                    }

                    contexts.features.push(newContext);
                    if (this.self.requested === queryableLayers.length)
                        this.self.setOutput(contexts);

                }.bind(context),
                onFailure: function() {

                    this.self.requested++;
                    if (this.self.requested === queryableLayers.length)
                        this.self.setOutput(contexts);

                }.bind(context)
            });

        }

        if (!this.map.layers.length) {
            this.requested = 1;
            alert(_('No queryable layers found'));
        }
    },
    /** 
     * @private 
     *
     * @param {String} string to print on target
     */
    setOutput: function(features) {

        this.mapManager.sendFeatureInfo(features);
    },
    CLASS_NAME: "OpenLayers.Control.WMSQuery"

});
