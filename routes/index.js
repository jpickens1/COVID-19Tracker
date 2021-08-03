var express = require("express");
var fs = require("fs");
var needle = require('needle');
var csv2geojson = require('csv2geojson');
var moment = require('moment-timezone');


var state_border_data = require('../public/data/border_data/state_border.json');
var county_border_data = require('../public/data/border_data/county_border_data.json');
var state_avg_location = require('../public/data/border_data/state_avg_location.json');

var newest_data;


var router = express.Router();



//get current month, date, year to obtain the data url for the latest data
let date_ob = new Date();

//since the data source usually updates yesterday's data between 03:00-04:00 UTC, therefore if Date() returns a time before 06:00, we offset 2 days back, and 1 day back otherwise.
if(date_ob.getHours()<6){
	date_ob.setDate(date_ob.getDate() - 2); //getting data from the day before
}
else{
	date_ob.setDate(date_ob.getDate() - 1); //getting newest data from yesterday
}
 

//adjust 0 before single digit date
let date = ("0" + date_ob.getDate()).slice(-2);
let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
let year = date_ob.getFullYear();
let current_time = month + "-" + date + "-" + year;

let state_data_base_url = 'https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_daily_reports_us/';
let county_data_base_url = 'https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_daily_reports/';

let state_data_url = state_data_base_url+ current_time+'.csv';
let county_data_url = county_data_base_url+ current_time+'.csv';

let last_update;




router.get("/",function(req,res){
    needle.get(state_data_url, function(error, response) {
        if (!error && response.statusCode == 200)
            newest_data = response.body;
            var geoJson = csv2geojson.csv2geojson(newest_data, {
                latfield: 'Lat',
                lonfield: 'Long_',
                delimiter: ','
            }, function(err, data) {
                if (err){
                    console.error(err)
                }
                
                //get last_update time for data for format it with moment()
                let update_time_raw = data['features'][0]['properties']['Last_Update'];
                let update_time_utc=update_time_raw.slice(0,16);
                let a = moment.utc(update_time_utc).tz("America/New_York");
                last_update = a.format('LLL'); //  June 9 2014 9:32 PM
                
                        
                state_border_data['features'].forEach(function(state){
                    var fips_raw= state['properties']['GEO_ID'];
                    var fips_target = String(Number(fips_raw.slice(fips_raw.length - 2)));
                    //console.log("fips target:",fips_target);
                    
                    
                    data['features'].forEach(function(location){
                        if (parseInt(location['properties']['FIPS']) ==fips_target){
                            state['properties']['Incident_Rate'] = parseInt(Number(location['properties']['Incident_Rate']));
                            state['properties']['Case_Fatality_Ratio'] = Number(location['properties']['Case_Fatality_Ratio']).toFixed(2);
                            
                           

                        
                        }
                    });
                    
                });
                fs.writeFile ("./public/data/state.geojson", JSON.stringify(state_border_data), function(err) {
                    if (err) throw err;
                    console.log('complete');
                    res.render("mainmap",{data: state_border_data, last_update: last_update});
                });
                    
            });
    });
    
});


    
     
router.get("/:stateName",function(req,res){
    var stateFIPS;
    var state_valid = 0;
    var state_coord=[];
    var state_lat;
    var state_lon;
    var state_zoom;
    var stateName = req.params.stateName;
    //varify the name is valid by searching in json, if not valid, send("not valid state name!")
    //find FIPS and lat and lon for the state
    
    console.log("Getting data for: "+req.params.stateName);

    for (var i=0; i< state_avg_location.length; i++){
        
        if (state_avg_location[i].state== stateName){
            stateFIPS = state_avg_location[i].FIPS;
            state_lat = state_avg_location[i].latitude;
            state_lon = state_avg_location[i].longitude;
            state_zoom = state_avg_location[i].zoom-0.3;
            state_coord.push(state_lon);
            state_coord.push(state_lat);
            state_valid = 1;
        }
        
    }

    
    if (state_valid == 1){
        needle.get(county_data_url, function(error, response) {
        if (!error && response.statusCode == 200)
            newest_data = response.body;
            var geoJson = csv2geojson.csv2geojson(newest_data, {
                latfield: 'Lat',
                lonfield: 'Long_',
                delimiter: ','
            }, function(err, data) {
                if (err){
                    console.error(err)
                }
                
                //get last_update time for data for format it with moment()
                let update_time_raw = data['features'][0]['properties']['Last_Update'];
                let update_time_utc=update_time_raw.slice(0,16);
                let a = moment.utc(update_time_utc).tz("America/New_York");
                last_update = a.format('LLL'); //  June 9 2014 9:32 PM
                
                county_border_data['features'].forEach(function(county){
                    var fips_raw= county['properties']['GEO_ID'];
                    var fips_target = String(Number(fips_raw.slice(fips_raw.length - 5)));
                    
                    
                    data['features'].forEach(function(location){
                    if (location['properties']['FIPS'] ==fips_target){
                        county['properties']['Confirmed'] =Number(location['properties']['Confirmed']);
                        county['properties']['Case_Fatality_Ratio'] = Number(location['properties']['Case_Fatality_Ratio']).toFixed(2);
                        

                        }
                    });
                    
                });
                fs.writeFile ("./public/data/county.geojson", JSON.stringify(county_border_data), function(err) {
                    if (err) throw err;
                    console.log('complete');
                    //console.log("state FIPS: "+stateFIPS);
                    console.log(state_coord);
                    res.render("statemap", {stateName: stateName,stateFIPS: stateFIPS, state_coord: state_coord,state_zoom: state_zoom, last_update: last_update});
                });
                    
            });
        });
    
        
    }else{
        res.send("Something went wrong!");
    }
    
    
    
    
    
    

});


module.exports = router;
