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

conwet.map.MarkerManager = Class.create({
    initialize: function(map) {
        this.map = map;        

        this.selectedMarker = null;

        this.userMarkers = new OpenLayers.Layer.Markers("User  markers");
        this.eventMarkers = new OpenLayers.Layer.Markers("Event markers");
        this.queryMarkers = new OpenLayers.Layer.Markers("Query markers");        
        this.boxesMarkers = new OpenLayers.Layer.Boxes("Boxes");
        
        var blue = {strokeColor: '#0000ff',
		  strokeOpacity: 0.5,
		  strokeWidth: 5 };
        
        this.routesLayer = new OpenLayers.Layer.Vector("Routes", {style:blue});
       
        this.map.addLayer(this.routesLayer);
        this.map.addLayer(this.userMarkers);
        this.map.addLayer(this.eventMarkers);
        this.map.addLayer(this.queryMarkers);
        this.map.addLayer(this.boxesMarkers);
        
        
        //Google maps directions service
        this.directionsService = new google.maps.DirectionsService();
        this.activeRoute = null;
        this.currentStep = 0;
        this.steps = null;

        this.lastUserMarker = 0;
        this.box = null;
        this.transformer = new conwet.map.ProjectionTransformer(this.map);
        this.markers = {};
        this._drawToolbar();
        this.showToolbar(true); // TODO Toolbar visible solo en el modo Marker
        this._updateToolbar();
    },
    _drawToolbar: function() {
        this.toolbar = document.createElement("div");
        $(this.toolbar).addClassName("marker_toolbar");
        this.map.viewPortDiv.appendChild(this.toolbar);

        this.removeAllButton = conwet.ui.UIUtils.createButton({
            "classNames": ["marker_button", "remove_all"],
            "title": _("Remove all markers"),
            "onClick": this._removeAllMarkers.bind(this)
        });
        this.toolbar.appendChild(this.removeAllButton);

        this.removeQueryButton = conwet.ui.UIUtils.createButton({
            "classNames": ["marker_button", "remove_query"],
            "title": _("Remove all temporal markers"),
            "onClick": this._removeTemporalMarkers.bind(this)
        });
        this.toolbar.appendChild(this.removeQueryButton);

        this.removeSelectedButton = conwet.ui.UIUtils.createButton({
            "classNames": ["marker_button", "remove_selected"],
            "title": _("Remove selected marker"),
            "onClick": this._removeSelectedMarker.bind(this)
        });
        this.toolbar.appendChild(this.removeSelectedButton);

        this.saveButton = conwet.ui.UIUtils.createButton({
            "classNames": ["marker_button", "save"],
            "title": _("Change to user marker"),
            "onClick": this._saveSelectedMarker.bind(this)
        });
        this.toolbar.appendChild(this.saveButton);
    },
    showToolbar: function(show) {
        this._showElement(this.toolbar, show);
    },
    _showElement: function(element, show) {
        if (show) {
            $(element).removeClassName("no_display");
        }
        else {
            $(element).addClassName("no_display");
        }
    },
    _updateToolbar: function() {
        var hasQuery = this.queryMarkers.markers.length > 0;
        var hasEvent = this.eventMarkers.markers.length > 0;
        var hasUser = this.userMarkers.markers.length > 0;
        var hasBox = (this.box != null);

        this._showElement(this.saveButton, false);
        this._showElement(this.removeSelectedButton, false);
        this._showElement(this.removeQueryButton, false);

        if (!hasQuery && !hasEvent && !hasUser && !hasBox) {
            this._showElement(this.removeAllButton, false);
        }
        else {
            this._showElement(this.removeAllButton, true);
        }

        return; // TODO Gestion de POIs

        if (!hasQuery && !hasEvent && !hasUser && !hasBox) {
            this._showElement(this.saveButton, false);
            this._showElement(this.removeSelectedButton, false);
            this._showElement(this.removeAllButton, false);
            this._showElement(this.removeQueryButton, false);
        }
        else {
            this._showElement(this.removeAllButton, true);
            this._showElement(this.removeQueryButton, hasQuery || hasEvent);
            this._showElement(this.saveButton, (this.selectedMarker != null) &&
                    (this.selectedMarker.getType() != OpenLayers.AdvancedMarker.USER_MARKER));
            this._showElement(this.removeSelectedButton, this.selectedMarker != null);
        }
    },
    /*setMarkers: function(locations) {
     this.eventMarkers.clearMarkers();
     for (var i=0; i<locations.length; i++){
     var location = locations[i];
     this.setMarker(new OpenLayers.LonLat(location.lon, location.lat), location.title, "", 0, true);
     }
     },*/
    //id, icon, title, subtitle, lonlat, type, popup, center
    /*setMarker: function(id, lonlat, title, text, type, popup, center, onClick, id) {
     
     this._setMarker(lonlat, title, text, type, popup, center, onClick, id);
     },*/
    deleteMarker: function(id){
      if (id != null && this.markers[id] != null) {
            var marker = this.markers[id];
            marker.getLayer().removeMarker(marker);
            delete this.markers[id];
        }  
    },
    setMarker: function(id, icon, title, subtitle, lonlat, type, popup, center, onClick) {
        //var marker = this._getExistingMarker(lonlat); // Si el marcador ya existe

        var marker;
        //If marker exists we delete it in order to add it again
        this.deleteMarker(id);

        var markersLayer = this._getMarkersLayer(type);
        var finalId;

        if (id) {
            finalId = id;
        } else {
            this.lastUserMarker++;
            id = "userMarker" + this.lastUserMarker;
        }

        var marker = new OpenLayers.AdvancedMarker(id, icon, this, type, markersLayer, this.map, lonlat, title, subtitle, function(marker) {
            if (!marker.isSelected() && (this.selectedMarker != null)) {
                this.selectedMarker.setSelected(false);
            }
            this.selectedMarker = marker;
            this._updateToolbar();

            onClick(marker);
        }.bind(this));

        this.markers[id] = marker;
        markersLayer.addMarker(marker);


        if (type == OpenLayers.AdvancedMarker.EVENT_MARKER && center) {
            marker.centerInMap();
        }

        if (popup) {
            marker.addPopup();
        }
        else {
            this.clearPopups();
        }

        this._updateToolbar();
        if (type === OpenLayers.AdvancedMarker.USER_MARKER) {
            onClick(marker);
        }
    },
    setHighlightMarker: function(id) {
        var marker = this.markers[id]; // Si el marcador ya existe
        if (marker != null) {
            if (this.selectedMarker != null) {
                this.selectedMarker.setSelected(false);
            }
            this.selectedMarker = marker;
            this._updateToolbar();
            this.selectedMarker.setSelected(true);
            this.selectedMarker.addPopup();
            this.map.setCenter(this.selectedMarker.lonlat);
        }
    },
    _getExistingMarker: function(lonlat) {
        var layers = [this.queryMarkers, this.eventMarkers, this.userMarkers];

        for (var i = 0; i < layers.length; i++) {
            var markers = layers[i].markers;
            for (var j = 0; j < markers.length; j++) {
                if (markers[j].exist(lonlat)) {
                    return markers[j];
                }
            }
        }

        return null;
    },
    _getMarkersLayer: function(type) {
        var markersLayer = null;
        switch (type) {
            case OpenLayers.AdvancedMarker.QUERY_MARKER:
                markersLayer = this.queryMarkers;
                break;
            case OpenLayers.AdvancedMarker.EVENT_MARKER:
                markersLayer = this.eventMarkers;
                break;
            default:
                markersLayer = this.userMarkers;
        }

        return markersLayer;
    },
    //This function updates a marker with a id given and updated information
    updateMarker: function(markerInfo) {
        var marker = this.markers[markerInfo.id];
        if (marker != null) {
            var icon = (markerInfo.icon) ? markerInfo.icon : marker.icon;
            var title = (markerInfo.title) ? markerInfo.title : marker.title;
            var subtitle = (markerInfo.subtitle) ? markerInfo.subtitle : marker.subtitle;
            var lonlat = (markerInfo.lonlat) ? markerInfo.lonlat : marker.lonlat;
            var type = marker.type;
            var onClick = marker.onClick;

            this.setMarker(marker.id, icon, title, subtitle, lonlat, type, true, false, onClick);
        }
    },
    _updateMarker: function(marker, title, text, type, onClick) {
        marker.setText(text);
        marker.setTitle(title);
        marker.setHandler(onClick);

        if (marker.getType() == type)
            return;

        switch (marker.getType()) {
            case OpenLayers.AdvancedMarker.QUERY_MARKER:
                this._changeTypeMarker(marker, type);
                break;
            case OpenLayers.AdvancedMarker.EVENT_MARKER:
                if (type == OpenLayers.AdvancedMarker.USER_MARKER) {
                    this._changeTypeMarker(marker, type);
                }
                break;
        }
    },
    _changeTypeMarker: function(marker, type) {
        marker.getLayer().removeMarker(marker);
        marker.setType(type);
        var markersLayer = this._getMarkersLayer(type);
        marker.setLayer(markersLayer);
        markersLayer.addMarker(marker);
    },
    getNumLayers: function() {
        return 5;
    },
    _removeAllMarkers: function() {
        this.userMarkers.clearMarkers();
        this.eventMarkers.clearMarkers();
        this.queryMarkers.clearMarkers();
        this.boxesMarkers.clearMarkers();
        this.box = null;
        this.selectedMarker = null;
        this.clearPopups();
        this._updateToolbar();
        this.markers = {};
        this.lastUserMarker = 0;

    },
    _removeTemporalMarkers: function() {
        this.queryMarkers.clearMarkers();
        this.eventMarkers.clearMarkers();
        if ((this.selectedMarker != null) &&
                ((this.selectedMarker.getType() == OpenLayers.AdvancedMarker.QUERY_MARKER) ||
                        (this.selectedMarker.getType() == OpenLayers.AdvancedMarker.EVENT_MARKER))) {
            this.selectedMarker = null;
        }
        this.clearPopups();
        this._updateToolbar();
    },
    _removeSelectedMarker: function() {
        if (this.selectedMarker != null) {
            this.selectedMarker.getLayer().removeMarker(this.selectedMarker);
            this.selectedMarker = null;
            this.clearPopups();
            this._updateToolbar();
        }
    },
    _saveSelectedMarker: function() {
        if (this.selectedMarker != null) {
            this._changeTypeMarker(this.selectedMarker, OpenLayers.AdvancedMarker.USER_MARKER);
            this.clearPopups();
            this._updateToolbar();
        }
    },
    clearPopups: function() {
        for (var i = 0; i < this.map.popups.length; i++) {
            var popup = this.map.popups[i];
            this.map.removePopup(popup);
            popup.destroy();
        }
    },
    setBox: function(positionInfos) {
        var bounds = positionInfos.bbox;
        
        var newBounds = new OpenLayers.Bounds(); //bounds[2],bounds[1],bounds[0],bounds[3]        
        newBounds.extend(this.transformer.transform(new OpenLayers.LonLat(bounds[0], bounds[1])));
        newBounds.extend(this.transformer.transform(new OpenLayers.LonLat(bounds[2], bounds[3])));

        if (this.box != null) {
            this.boxesMarkers.removeMarker(this.box);
            this.box = null;
        }

        this.box = new OpenLayers.Marker.Box(newBounds);
        this.map.zoomToExtent(newBounds);


        this.boxesMarkers.addMarker(this.box);
        this._updateToolbar();
    },
    updateMarkers: function(oldProj, newProj) {
        var markers2 = {};       

        for (var id in this.markers) {
            var updatedMarker = {
                lonlat: {},
                title: this.markers[id].title,
                text: this.markers[id].text,
                type: this.markers[id].type,
                popup: this.markers[id].popup,
                center: this.markers[id].center,
                onClick: this.markers[id].onClick
            }
            updatedMarker.lonlat = this.transformer.advancedTransform(new OpenLayers.LonLat(this.markers[id].lon, this.markers[id].lat), oldProj, newProj);
            markers2[id] = updatedMarker;

        }

        this._removeAllMarkers();

        for (var id in markers2) {
            this.setMarker(markers2[id].lonlat, markers2[id].title, markers2[id].text, markers2[id].type, markers2[id].popup, markers2[id].center, markers2[id].onClick)
        }

    },
    getMarkersInfo: function(){
        var bounds = this.map.getExtent();
        
        var visibleMarkers = [];
        for (var id in this.markers) {
            if (bounds.containsLonLat(this.markers[id].lonlat)) {
            
                var markerInfo = this.markers[id].getInfo();
               
                
                var lonlat = this.transformer.normalize(this.markers[id].lonlat);
                markerInfo.coordinates = {
                    longitude: lonlat.lon,
                    latitude: lonlat.lat
                };
                
                visibleMarkers.push(markerInfo);
            }
        }
        return visibleMarkers;
    },
    drawRoute: function(route){ 
        this.deleteActiveRoute();
        this.createRouteFromMakers(route.from, route.to);
    }, 
     /*
     * This function creates a route given two ids from two existing markers in the map
     */
    createRouteFromMakers: function(id1, id2){
        if (!this.markers[id1] || !this.markers[id2]){
            throw "IDs must identify two existing markers."
        }
        var coords1 = this.markers[id1].lonlat;
        var coords2 = this.markers[id2].lonlat;
        
        coords1 = this.transformer.normalize(coords1);
        coords2 = this.transformer.normalize(coords2);
        
        
        var request = {
            origin: new google.maps.LatLng(coords1.lat, coords1.lon),
            destination:  new google.maps.LatLng(coords2.lat, coords2.lon),
            travelMode: google.maps.DirectionsTravelMode.DRIVING
        };
        /* We make the request to Google API.
         * This will return a JSON object route.*/
         
        this.directionsService.route(request, function (response, status) {
            if (status == google.maps.DirectionsStatus.OK) {
                var directionsResult = response.routes;
                
                this.activeRoute = directionsResult[0];                
                
                if (this.activeRoute.stepInfoWindow) {
                    this.activeRoute.stepInfoWindow.close();
                }
                MashupPlatform.wiring.pushEvent("routeDescriptionOutput", JSON.stringify(directionsResult));
                this.drawActiveRoute();
            }
        }.bind(this));        
    },
    /*
     * This function draws the current route in the map
     */        
    drawActiveRoute: function(){
        var steps = this.activeRoute.legs[0].steps;
        var points = new Array();
        for (var i = 0; i < steps.length; i++){
            steps[i].startLonLat = new OpenLayers.LonLat(steps[i].start_location.B, steps[i].start_location.k);
            
            //Maybe useful in the future?
            //steps.endLonLat = new OpenLayers.LonLat(steps.end_location.lng, steps.end_location.lat);
            
            //Useful to display the current step with stepRouteInput
            steps[i].startLonLat = this.transformer.transform(steps[i].startLonLat);
            
            //We get the point in x and y coordinates to draw the route
            //var point =  this.map.getPixelFromLonLat(steps[i].startLonLat)
            var point = new OpenLayers.Geometry.Point(steps[i].startLonLat.lon, steps[i].startLonLat.lat);
            points.push(point);
        }
        //We add the line to the routes layer
        this.steps = steps;
        var linestring = new OpenLayers.Geometry.LineString(points);
        var vector = new OpenLayers.Feature.Vector(linestring);
        this.routesLayer.addFeatures([vector]);        
    },
    deleteActiveRoute: function(){
        this.activeRoute = null;
        this.steps = null;        
        this.routesLayer.removeAllFeatures();
    },
    
    //This function draws a marker indicating the current step in the route
    setStep: function(stepNum){
        if (!this.activeRoute || !this.steps){
            throw "A route must be provided in order to display its steps";
        }
        
        //setMarker: function(id, icon, title, subtitle, lonlat, type, popup, center, onClick)        
        //We will create a marker with the step information
        var step = this.steps[stepNum];
        if (!step){
            throw "This step does not exist in the current route";
        }
        var instructions = step.instructions;
        var type = OpenLayers.AdvancedMarker.QUERY_MARKER;
        this.setMarker("step", null, "Step " + stepNum, instructions, step.startLonLat, type, true, false);
    }

});
