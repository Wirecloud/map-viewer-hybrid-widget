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

conwet.map.WmtsService = Class.create({
    initialize: function(xml) {

        this.formats = xml.getElementsByTagName("Format");
        this.wms = (new OpenLayers.Format.WMTSCapabilities()).read(xml);

        if (this.wms.version == "1.3.0") {
            this.wms = (new OpenLayers.Format.WMTSCapabilities({defaultVersion: "1.3.0"})).read(xml);
        }

        this.layers = $H();
        
        this.correctOrder(this.wms.contents.tileMatrixSets);

        for (var i = 0; i < this.wms.contents.layers.length; i++) {
            this.addLayer(new conwet.map.WmtsLayer(this.wms.contents.layers[i], this.wms.version, this.wms.contents.tileMatrixSets));
        }

    },
    getName: function() {
        return this.wms.serviceIdentification.name;
    },
    getTitle: function() {
        return this.wms.serviceIdentification.title;
    },
    getAbstract: function() {
        return this.wms.serviceIdentification.abstract;
    },
    getVersion: function() {
        return this.wms.version;
    },
    getLayers: function() {
        var layers = [];
        var keys = this.layers.keys();

        for (var i = 0; i < keys.length; i++) {
            layers.push(this.getLayer(keys[i]));
        }
        return layers;
    },
    getFeatureInfoFormat: function() {
        var preferredFormats = ['application/vnd.ogc.gml', 'application/xml', 'text/html'];
        var formats = this.wms.capability.request.getfeatureinfo.formats;

        for (var i = 0; i < preferredFormats.length; i++) {
            var formatIndex = formats.indexOf(preferredFormats[i]);
            if (formatIndex != -1) {
                return formats[formatIndex];
            }
        }

        return formats[0];
    },
    getLayer: function(name) {
        return this.layers.get(name);
    },
    addLayer: function(layer) {
        this.layers.set(layer.getName(), layer);

        for (var i = 0; i < layer.nestedLayers.length; i++) {
            this.addLayer(layer.nestedLayers[i]);
        }
    },
    removeLayer: function(name) {
        this.layers.unset(name);
    },
    isWmsc: function(xml) {

        var keywords = xml.getElementsByTagName("Keyword");

        for (var i = 0; i < keywords.length; i++) {
            var keyword = keywords[i].childNodes[0];
            if (keyword != null) {
                var wholeText = keyword.wholeText;
                if (keyword === "WMS-C" || keyword === "WMSC") {
                    return true;
                }
            }
        }
        return false;
    },
    /*Inverses the order for projections 4326 and 4258 of the topleftcorners*/
    correctOrder: function(tileMatrixSets) {
        for (var proj in tileMatrixSets) {
            if (proj == "EPSG:4326" || proj == "EPSG:4258") {
                var matrixIds = tileMatrixSets[proj].matrixIds;
                for (var i = 0; i < matrixIds.length; i++) {
                    var lat = matrixIds[i].topLeftCorner.lon;
                    matrixIds[i].topLeftCorner.lon = matrixIds[i].topLeftCorner.lat;
                    matrixIds[i].topLeftCorner.lat = lat;
                }
            }
        }

    }

});


