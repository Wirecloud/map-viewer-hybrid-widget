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

conwet.map.MapManager = Class.create({
    initialize: function(gadget, options) {
        this.transformer = new conwet.map.ProjectionTransformer();
        this.gadget = gadget;
        this.map = new OpenLayers.Map($('map'), {
            controls: [],
            displayProjection: new OpenLayers.Projection("EPSG:4326"),
            //tileSize: new OpenLayers.Size(128, 128),
            zoomDuration: 10
                    //fractionalZoom: true            
        });

        this.cursorManager = options.cursorManager;
        this.cursorManager.setMap(this.map);
        this.transformer.setMap(this.map);

        this.geocoder = new google.maps.Geocoder();

        // Init
        this.isDrag = false;
        this.zoomLevel = 0;
        this.center = new OpenLayers.LonLat(-1, -1);

        //This displays the coordenates where the mouse is located in the map
        this.mousePosition = new OpenLayers.Control.MousePosition({formatOutput: function(lonLat) {
                var ns = OpenLayers.Util.getFormattedLonLat(lonLat.lat);
                var ew = OpenLayers.Util.getFormattedLonLat(lonLat.lon, 'lon');
                return ns + ', ' + ew;
            }});
        this.map.addControl(this.mousePosition);

        //this.map.addControl(new OpenLayers.Control.PanPanel());
        //this.map.addControl(new OpenLayers.Control.OverviewMap());

        //this.map.addControl(new OpenLayers.Control.MyScale()); //ScaleLine
        this.map.addControl(new OpenLayers.Control.ScaleLine({geodesic: true})); //    

        var nav = new OpenLayers.Control.Navigation(
                    {mouseWheelOptions: {interval: 0}}
        );

        this.map.addControl(nav);

        // OWSManager
        var initialServers = [];

        //The last registered services
        var servicesPreference = MashupPlatform.widget.getVariable("services");


        //If there where services registered before we load them in the services catalogue
        if (servicesPreference.get() != "") {
            initialServers = JSON.parse(servicesPreference.get());
        }

        this.owsManager = new OpenLayers.Control.OWSManager(this, initialServers);
        this.map.addControl(this.owsManager);

        // Options
        if (arguments.length > 1) {
            if ('onMove' in options) {
                this._onMove = options.onMove;
            }
            if ('onBeforeDrag' in options) {
                this._onBeforeDrag = options.onBeforeDrag;
            }
            if ('onAfterDrag' in options) {
                this._onAfterDrag = options.onAfterDrag;
            }
        }
        else {
            options = {};
        }

        options['onSetZoom'] = this.setZoom.bind(this);
        options['onZoomOut'] = this.zoomOut.bind(this);
        options['onZoomIn'] = this.zoomIn.bind(this);

        // MarkerManager
        this.markerManager = new conwet.map.MarkerManager(this.map);

        // ZoomBar
        //this.zoomBar = new conwet.ui.ZoomBar(options);
        //this.zoomBar.setZoom(0);
        this.plusButton     = $('zoom_plus');
        this.minusButton    = $('zoom_minus');
        this.plusButton.observe  ('click', this.zoomIn.bind(this));
        this.minusButton.observe ('click', this.zoomOut.bind(this));


        // Map Events
        this.map.events.register("moveend", this, function() {

            var changes = {};
            var bounds = this.map.getExtent();
            var upLeft = new OpenLayers.LonLat(bounds.left, bounds.top);
            var downRight = new OpenLayers.LonLat(bounds.right, bounds.bottom);
            
            upLeft = this.transformer.normalize(upLeft);
            downRight = this.transformer.normalize(downRight);
            
            var upperLeftCorner =  {longitude: upLeft.lon, latitude: upLeft.lat};
            var lowerRightCorner =  {longitude: downRight.lon, latitude: downRight.lat};
            changes.bounds = {upperLeftCorner:upperLeftCorner, lowerRightCorner:lowerRightCorner};
            var markers = this.markerManager.getMarkersInfo();
            this.sendMarkers(markers);
            var center = this.transformer.normalize(this.map.getCenter());
            var zoomLevel = this.map.getZoom();

            if (this.zoomLevel != zoomLevel) {
                this.zoomLevel = zoomLevel;
                //var zoom = zoomLevel / this.getNumZoomLevels();
                //this.zoomBar.setZoom(zoom);
                //changes["zoom"] = zoom;
            }

            if (!conwet.map.ProjectionTransformer.compareLonlat(this.center, center)) {
                this.center = center;
                //changes['center'] = center;
            }

            if (!this.gadget.reactingToWiring()) {
                /*if (('zoom' in changes) || ('center' in changes)) {
                    //this.markerManager.
                    this._onMove(changes);
                }*/
                this._onMove(changes);
            }
            /*} else {
             this.gadget.stopInit();
             }*/
            this.isDrag = false;
            this.mousePosition.activate();
            this._onAfterDrag();

        }.bind(this));

        this.map.events.register("movestart", this, function() {
            this.isDrag = true;
            this.mousePosition.deactivate();
            
            this._onBeforeDrag();
        }.bind(this));

        this.map.events.register('mouseover', this, function() {
            if (!this.isDrag) {
                this.mousePosition.activate();
            }
        });
        this.map.events.register('mouseout', this.mousePosition, this.mousePosition.deactivate);
    },
    getGadget: function() {
        return this.gadget;
    },
    updateState: function(state) {
        if ('zoom' in state && 'center' in state) {
            this.setZoomCenter(state.zoom, state.center);
        }
        else if ('zoom' in state) {
            this.setZoom(state.zoom);
        }
        else if ('center' in state) {
            this.setCenter(state.center.lon, state.center.lat);
        }else if ('bounds' in state){
            this.setBounds(state.bounds);
        }
       

    },
    setBounds: function(bounds){
        var upperLeftCorner = bounds.upperLeftCorner;
        var lowerRightCorner = bounds.lowerRightCorner;
        var topLeft = new OpenLayers.LonLat(upperLeftCorner.longitude, upperLeftCorner.latitude);
        var bottomRight = new OpenLayers.LonLat(lowerRightCorner.longitude, lowerRightCorner.latitude);
        
        topLeft = this.transformer.transform(topLeft);
        bottomRight = this.transformer.transform(bottomRight);
        //left, bottom, right, top
        this.map.zoomToExtent([topLeft.lon, bottomRight.lat, bottomRight.lon, topLeft.lat], true);
    },
    setCenter: function(lon, lat) {
        var center = this.transformer.transform(new OpenLayers.LonLat(lon, lat));

        if (!conwet.map.ProjectionTransformer.compareLonlat(this.center, center)) {
            this.map.setCenter(center, this.map.zoom, false);
        }
    },
    setZoom: function(zoom) {
        this._setZoomLevel(Math.round(this.getNumZoomLevels() * zoom));
    },
    zoomIn: function() {
        this._setZoomLevel(this.zoomLevel + 1);
    },
    zoomOut: function() {
        this._setZoomLevel(this.zoomLevel - 1);
    },
    addWmsService: function(name, url) {
        this.owsManager.addWmsService(name, url);
    },
    addWmscService: function(name, url) {
        this.owsManager.addWmscService(name, url);
    },
    addWmtsService: function(name, url) {
        this.owsManager.addWmtsService(name, url);
    },            
    _setZoomLevel: function(zoomLevel) {
        zoomLevel = (zoomLevel < 0) ? 0 : zoomLevel;
        zoomLevel = (zoomLevel >= this.getNumZoomLevels()) ? this.getNumZoomLevels() - 1 : zoomLevel;

        if (this.zoomLevel != zoomLevel) {
            this.map.zoomTo(zoomLevel);
        }
    },
    getLonLatFromPixel: function(x, y) {
        if (!this.map.baseLayer)
            return null

        return this.transformer.normalize(this.map.getLonLatFromPixel(new OpenLayers.Pixel(x, y)));
    },
    getPixelFromLonLat: function(lon, lat) {
        if (!this.map.baseLayer)
            return null

        return this.map.getPixelFromLonLat(this.transformer.transform(new OpenLayers.LonLat(lon, lat)));
    },
    _onMove: function(zoom) {
        // To overwrite
    },
    _onBeforeDrag: function() {
        // To overwrite
    },
    _onAfterDrag: function() {
        // To overwrite
    },
    setUserMarker: function(lon, lat, title, subtitle) {
        
        var id = null;
        var icon = null;
        subtitle = (arguments.length > 4) ? subtitle : "";
        title = (arguments.length > 3) ? title : "";
        var lonlat = new OpenLayers.LonLat(lon, lat);
        var type = OpenLayers.AdvancedMarker.USER_MARKER;
        
        this._setMarker(id, icon, title, subtitle, lonlat, type, true, false);
    },
    
    /*
     * Function that adds multiple markers simultaneously
     */
    setEventMarkers: function(markers) {        
        
        for (var i = 0; i < markers.length; i++) {            
            this.setEventMarker(markers[i], false);
        }

    },
    /*
     * Adds a marker to the map.
     * Marker: Object with the following structure.
     *  • id.
     *  • title.
     *  • subtitle.
     *  • icon: Image URL.
     *  • tooltip:
     *  • coordinates:
     *      ◦ longitude.
     *      ◦ latitude.
     * center: True if the map must be centered in the new added marker
     */
    setEventMarker: function(marker, center) {
        //Coordenates transformation
        if (!marker.id){
            throw "Marker must have an id in order to be added";
        }
        if (!marker.coordinates){//If old format we transform to new format
            marker.coordinates = {
                longitude: marker.currentLocation.lng,
                latitude: marker.currentLocation.lat
            }
        }
        
        var lonlat = new OpenLayers.LonLat(marker.coordinates.longitude, marker.coordinates.latitude)
        lonlat = this.transformer.transform(lonlat);
        
        var icon = (marker.icon != null) ? marker.icon : null;
        var title = (marker.title != null) ? marker.title : "";
        var subtitle = (marker.subtitle != null) ? marker.subtitle : "";
        var type = OpenLayers.AdvancedMarker.EVENT_MARKER;
        
        this._setMarker(marker.id, icon, title, subtitle, lonlat, type ,true, center)

    },
    selectPoi: function(id) {

        this.markerManager.setHighlightMarker(id);
    },
    deletePoi: function(id) {
        this.markerManager.deleteMarker(id);
    },
    setQueryMarker: function(lon, lat, title, text) {
        text = (arguments.length > 4) ? text : "";
        title = (arguments.length > 3) ? title : "";

        this._setMarker(this.transformer.transform(new OpenLayers.LonLat(lon, lat)), title, text, OpenLayers.AdvancedMarker.QUERY_MARKER, true);
    },
    _setMarker: function(id, icon, title, subtitle, lonlat, type, popup, center, onClick) {
        onClick = (arguments.length > 8) ? onClick : function() {
        };

        this.markerManager.setMarker(id, icon, title, subtitle, lonlat, type, popup, center, function(marker) {
            
            onClick(marker);
            //this.getGadget().sendLocation(ll.lon, ll.lat);
            var markerInfo = marker.getInfo();
                
            var ll = this.transformer.normalize(lonlat);
            markerInfo.coordinates = {
                longitude: ll.lon,
                latitude: ll.lat
            };
            this.getGadget().sendPoiInfo(markerInfo);
        }.bind(this));
    },
    getNumMarkerLayers: function() {
        return this.markerManager.getNumLayers();
    },
    setBox: function(locationInfo) {
        this.markerManager.setBox(locationInfo);
    },
    getNumZoomLevels: function() {
        var lvls = 0;
        if (this.map.scales != null) {
            lvls = this.map.scales.length;
        }
        else if (this.map.resolutions != null) {
            lvls = this.map.resolutions.length;
        }
        return lvls;
    },
    setZoomCenter: function(zoom, center) {
        var zoomLevel = Math.round(this.getNumZoomLevels() * zoom);
        zoomLevel = (zoomLevel < 0) ? 0 : zoomLevel;
        zoomLevel = (zoomLevel >= this.getNumZoomLevels()) ? this.getNumZoomLevels() - 1 : zoomLevel;


        var newCenter = this.transformer.transform(new OpenLayers.LonLat(center.lon, center.lat));
        if (!conwet.map.ProjectionTransformer.compareLonlat(this.center, center) || (this.zoomLevel != zoomLevel)) {
            this.map.setCenter(newCenter, zoomLevel);
        }
    },
    updateMarkers: function(oldProj, newProj) {
        if (this.markerManager != null)
            this.markerManager.updateMarkers(oldProj, newProj);
    },
    sendMarkers:function(markers){
        this.gadget.sendPoisInfo(markers);
    },
    sendFeatureInfo: function(context){
        var lonlat = this.map.getLonLatFromPixel(context.coordinates);
        lonlat = this.transformer.normalize(lonlat);
        context.coordinates = {longitude: lonlat.lon, latitude: lonlat.lat};
        this.getGadget().sendFeatureInfo(context);
    },
    
    drawRoute: function(route){        
        this.markerManager.drawRoute(route);
    },
    setRouteStep: function(step){
        this.markerManager.setStep(step);
    },
    /*◦ id. An id to identify the layer.
    ◦ service. String. Currently, only 'WMS' is supported.
    ◦ version. String. Currently, only '1.1.1' and '1.3.0' are supported.
    ◦ url. Url of the map service.
    ◦ name: String. Name of the layer.
    ◦ projection. String.
    ◦ zIndex. Integer,
    ◦ opacity. Integer. [0, 100]
    ◦ queryable. Boolean. If the layer has support for the getFeatureInfo request.
    */
    addLayerFromWiring: function(layerData, isBaseLayer){
        if (!isBaseLayer){
            this.owsManager.addLayerFromWiring(layerData.id, layerData.url, layerData.name, layerData.projection, isBaseLayer, layerData.service);
        }
        else{
            if (layerData.id){
                this.owsManager.selectBaseLayerFromWiring(layerData.id)
            }else{
                this.owsManager.addLayerFromWiring(null, layerData.url, layerData.name, layerData.projection, isBaseLayer, layerData.service);
            }
        }
    },
    removeLayerFromWiring: function(id){
        this.owsManager.removeLayerFromWiring(id);
    },
    setLocation: function(address, zoom){
        this.geocoder.geocode( { 'address': address}, function(results, status) {
          if (status == google.maps.GeocoderStatus.OK) {
            var location = results[0].geometry.location;
            var center = {lon: location.D, lat: location.k};
            zoom = (zoom/this.getNumZoomLevels());
            this.setZoomCenter(zoom, center);            
          } else {
            alert("Geocode was not successful for the following reason: " + status);
          }
        }.bind(this));
    }
    
});
