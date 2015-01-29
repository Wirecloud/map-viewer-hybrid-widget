/*
 *     Copyright (c) 2014 CoNWeT Lab., Universidad Politécnica de Madrid
 *     Copyright (c) 2014 IGN - Instituto Geográfico Nacional
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

conwet.map.WmtsLayer = Class.create({
    initialize: function(layer, version, tileMatrixSets) {
        this.layer = layer;
        this.parent = null;
        this.formats = [];
        this.projections = [];
        this.resolutions = $H();
        this.version = version;
        this.tileMatrixSets = tileMatrixSets;

        if (layer.identifier == null) {
            layer.formats = [];
        }

        for (var i = 0; i < layer.formats.length; i++) {
            var format = layer.formats[i];
            if (format == 'image/png') {
                this.formats.unshift(format);
            }
            else {
                this.formats.push(format);
            }
        }

        this.projections = [];
        
        for (var i = 0; i< layer.tileMatrixSetLinks.length; i++){
            this.projections[i] = layer.tileMatrixSetLinks[i].tileMatrixSet;
        }

        this.nestedLayers = [];
        for (var i = 0; i < layer.layers.length; i++) {
            var sublayer = new conwet.map.WmtsLayer(layer.layers[i], this.version);
            this.nestedLayers.push(sublayer);
            sublayer.setParent(this);
        }
    },
    getName: function() {
        return this.layer.identifier;
    },
    getTitle: function() {
        return this.layer.title;
    },
    getAbstract: function() {
        return this.layer.abstract;
    },
    isQueryable: function() {
        return this.layer.queryable;
    },
    getProjections: function() {
        return this.projections;
    },
    getFormats: function() {
        return this.formats;
    },
    getExtent: function(srs, toZoom) {
        if (this.tileMatrixSets[srs])
            return this.tileMatrixSets[srs].bounds;
        else return this.getMaxExtent(srs);
        
    
    },
    getMaxExtent: function(proj) {
        if (proj == "EPSG:3857" )
            return new OpenLayers.Bounds(-20037508.34, -20037508.34, 20037508.34, 20037508.34);

        if (proj == "EPSG:32630" || proj == "EPSG:25830" || proj == "EPSG:23030")
            return this.getExtent(proj);
           
        var transformer = new conwet.map.ProjectionTransformer();
        return transformer.getExtent([-180, -90, 180, 90], 'EPSG:4326', proj);
    },
    getAtribution: function() {
        return this.layer.attribution;
    },
    getLegendUrl: function() {
        if ((this.layer.styles.length > 0) && ("legend" in this.layer.styles[0])) {
            return this.layer.styles[0].legend.href;
        }
        return null;
    },
    getResolutions: function(key) {
        return this.resolutions.get(key);
    },
    setParent: function(parent) {
        this.parent = parent;
    }

});
