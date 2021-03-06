/** This is where we require the express module */
var express = require('express');
/** Creation of express server */
var app = express();
/** creation of express server over http */
var http = require('http').createServer(app);
/** Requiring socket.io */
var io = require('socket.io')(http);
/** Requiring path module */
var path = require('path');
/**Requiring nodemailer module*/
var nodemailer = require('nodemailer');
/** Creating mailing service with gmail using nodemailer */
var smtpTransport = nodemailer.createTransport({
	service: 'Gmail',
	auth: {
		user: 'elanor2050@gmail.com',
		pass: ''
	}
});

/** requiring expresss-session module for the sesssion purpose */
var session = require('express-session');
/** requiring crypto module for hashing password */
var crypto = require('crypto');
/** requiring body-parser module for dealing with post requests */
var bodyparser = require('body-parser');
/** requiring express */
var validator = require('express-validator');
/** requiring multer for file uploading */
var multer = require('multer');
/** using urlencoded function of bodyparser for dealing with post requests */
var urlencodedparser = bodyparser.urlencoded({extended: false});
/** session middleware for using the session */
var sessionMiddleware = session({
	secret: 'hello',
	cookie: {}
});
/** configuring to use session with socket.io */
io.use(function(socket, next){
	sessionMiddleware(socket.request, socket.request.res, next);
});
/** using session widdleware */
app.use(sessionMiddleware);
/** defining static path with express */
app.use(express.static(path.join(__dirname, 'static')));
/** using validator */
app.use(validator());
//////////User login pages...and request ////////////////////////////////////////
////////////////////////module exports//////////////
/** exporting io object of socket.io module for using in other module */
module.exports.io=io;
/** exporting crypto object of crypto module for using in other module */
module.exports.crypto = crypto;
/**  exporting urlencoded parser object of body parser module for using in other modules */
module.exports.urlencodedparser=urlencodedparser;
/** exporting multer object of multer module for using in other modules */
module.exports.multer = multer;
/** exporting sendMail function to use in other modules for sending mail */
module.exports.sendMail = sendMail;



/////////////////module exports end///////////////////
/** requiring user custom module to deal with the user creation and login and other features */
var user = require('./user');
/** requiring vehicleadd custom module to deal with eh vehicle addition and other features regarding it. */
var vehicleadd = require('./vehicleadd');
/** requiring vehicledata custom module to deal with the data from the vehicle */
var vehicledata = require('./vehicledata');
/** requiringf appAPI module to deal with the data transfer with app */
var appAPI = require('./appAPI');
/** requiring vehicle custom module to deal with all the features related with the vehicle */
var vehicle = require('./vehicle');
/** requiring poi custom module to deal with all the features related to poi */
var poi = require('./poi');
/** requiring db custom module to deal with the database  */
var db = require('./db');

/** routing to user module 
*@typedef indexPageROuting
*/
app.use('/', user);
/** routing to vehicleadd module 
*@typedef indexPageROuting
*/
app.use('/vehicleadd',vehicleadd);
/** routing to vehicledata module 
*@typedef indexPageROuting
*/
app.use('/vehicledata',vehicledata);
/** routing to appAPI module 
*@typedef indexPageROuting
*/
app.use('/api',appAPI);
/** routing to vehicle module 
*@typedef indexPageROuting
*/
app.use('/vehicle',vehicle);
/** routing to poi module 
*@typedef indexPageROuting
*/
app.use('/poi', poi);

/////////////////////////////// socket.io parts ///////////////////////////////
/** main socket io part while on connection 
*@typedef mainConnectionOfSocket
*/
io.on('connection', function (socket){

////////////////////////////////////vehicle/////////////////////////////////////
	/////////////////////vehicle and map//////////////////////////////
	/** socket receiver of event 'vehicle' with data of vehicle name 
	*@typedef vehicle
	*/
	socket.on('vehicle', function (data){
		socket.request.session.vehicle_id='';
		socket.request.session.company_id_vehicle = '';
		socket.request.session.device_id ='';
		var vehicle = data.vehicle.trim();
		console.log("The vehicle Clicked: "+vehicle);
		var username =socket.request.session.user;
		/**getting data related to vehicle on event 'vehicle'
		*@typedef vehicle
		*/
		db.select('SELECT company_detail.id AS company_id,vehicle.id AS '+
					'vehicle_id,vehicle.device_id FROM company_detail INNER JOIN vehicle ON '+
					'company_detail.id=vehicle.company_id WHERE company_detail.username=$1 '+
					'AND vehicle.name=$2', [username,vehicle], function (err, result){
						if(err){

						}else{
							console.log(result);
							/**Setting socket session on event 'vehicle'
							*@typedef settingSocketSessionForVehicle
							*/
							socket.request.session.vehicle_id= result[0].vehicle_id;
							socket.request.session.company_id_vehicle = result[0].company_id;
							socket.request.session.device_id = result[0].device_id;
							console.log(socket.request.session.vehicle_id);  
						}
		});
	});
	/** Socket receiver on event 'vehicle_map'
	*@typedef vehicle_map
	*/
	socket.on('vehicle_map', function(data){
		if(!socket.request.session.vehicle_id){
			var username = socket.request.session.user;
			console.log("vehicle_map without session");
			/** Selecting vehicle name and device id..if vehicle_id not set..in event 'vehicle_map' for finding vehicle locations of all vehicle under company 
			*@typedef vehicle_map
			*/
			db.select('SELECT vehicle.name AS vehicle,vehicle.device_id '+
						'AS device_id FROM company_detail INNER JOIN vehicle ON '+
						'company_detail.id=vehicle.company_id  WHERE '+
						'company_detail.username=$1', [username], function (err, result){
							if(err){

							}else{
								var vehicleList=[];
								console.log(result);
								for(var row=0;row<result.length;row++){
									vehicleList.push(result[row]);
								}
								console.log(vehicleList);
								var vehicle_data=[];
								var vehicle_count=0;
								(function getVehicleLocation(){
									if(vehicleList[vehicle_count]){
										db.select('SELECT latitude,longitude FROM vehicle_data WHERE device_id=$1 ORDER BY date DESC,time DESC LIMIT 1',
										 [vehicleList[vehicle_count].device_id], function (err, result){
										 	if(err){

										 	}else{
										 		if(result.length!=0){
													var vehicle_location = result[0];
													vehicle_location.vehicle = vehicleList[vehicle_count].vehicle;
													vehicle_data.push(vehicle_location);
													vehicle_count++;
													getVehicleLocation();
												}else{
													vehicle_count++;
													getVehicleLocation();
												}
										 	}
										 });
										
									}else{
										console.log(vehicle_data);
										socket.emit('vehicle_map_first',vehicle_data);
									}										
								})();
							}
			});
		}else{
			var vehicle_id=socket.request.session.vehicle_id;
			var company_id=socket.request.session.company_id_vehicle;
			var device_id=socket.request.session.device_id;
			console.log("vehicle_map with session");
			var d = new Date();
			var sdd = d.toISOString();
			var date = sdd.substring(0,10).replace(/-/gi,'');
			/** Selecting latitude longitude of vehicle..if vehicle_id set.. on vehicle_map
			*@typedef vehicle_map
			*/
			db.select('SELECT latitude, longitude FROM '+
						'vehicle_data WHERE date=$1 and device_id=$2 ORDER By time', 
						[date, device_id], function (err, result){
							if(err){

							}else{
								if(result.length!=0){
									socket.emit('vehicle_map_location', result);
									console.log(result);
								}else{
									socket.emit('vehicle_map_location');
								}
							}
			});
			/** Selecting poi details of unfinished job..if vehicle_id set.. on vehicle_map
			*@typedef vehicle_map
			*/
			db.select('SELECT poi_latitude AS latitude, poi_longitude AS longitude,poi_name as poi,'+
				' poi_detail AS detail FROM '+
				'activity WHERE vehicle_id=$1 GROUP BY poi_latitude, poi_longitude,poi_name, poi_detail '+
				'HAVING bool_and(status)=$2', [vehicle_id, false], function (err, result){
					if(err){

					}else{
						console.log(result);
						socket.emit('vehicle_poi_location', result);
					}
				});
		}
	});
	
	////////////////////vehicle and map end///////////////////////////
	//////////////////////vehicle and activity////////////////////////
	/** socket receiver on event 'vehicle_activity' ->Selects the poi name,date and status for the particular vehicle
	*@typedef vehicle_activity
	*/
	socket.on('vehicle_activity', function(data){
		if(!socket.request.session.vehicle_id){

		}else{
			var vehicle_id=socket.request.session.vehicle_id;
			var company_id=socket.request.session.company_id_vehicle;
			var device_id=socket.request.session.device_id;
			console.log("vehicle_activity with session");
			/** Selecting poi_name detail and status of poi's related to vehicle on event 'vehicle_activity'
			*@typedef vehicle_activity
			*/
			db.select('SELECT poi_name AS poi,date,bool_and(status) AS status '+
						'FROM activity '+
						'WHERE company_id=$1 AND vehicle_id=$2 GROUP BY poi_name,date',
						[company_id,vehicle_id], function (err, result){
							if(err){

							}else{
								socket.emit('vehicle_activity_info',result);
								console.log(result);

							}
			});
		}
	});
	/** socket receiver on event 'vehicle_activity_poi' ->Select and send number of times visited by vehicle group by month for particular 
	poi and list of that poi's activities 
	*@typedef vehicle_activity_poi
	*/
	socket.on('vehicle_activity_poi', function (data){
		socket.request.session.vehicle_activity_poi_id=''
		var poi = data.poi;
		var vehicle_id=socket.request.session.vehicle_id;
		var company_id=socket.request.session.company_id_vehicle;
		var device_id=socket.request.session.device_id;
		/** Selecting count of visit for specific poi of specific vehicle on event 'vehicle_activity_poi' 
		*@typedef vehicle_activity_poi
		*/
		db.select('SELECT substring(date from 1 for 6) AS date,'+
					'count(DISTINCT CONCAT(poi_name,date)) FROM activity WHERE company_id=$1 AND vehicle_id=$2 AND '+
					'poi_name=$3 GROUP BY substring(date from 1 for 6)',
					[company_id,vehicle_id,poi], function (err,result){
						if(err){

						}else{
							socket.emit('vehicle_activity_poi_frequency', result);
							console.log(result);
						}
		});

		/** Selecting activity and status of specific poi of specific vehicle on event 'vehicle_activity_poi' 
		*@typedef vehicle_activity_poi
		*/
		db.select('SELECT poi_id,activity,status FROM activity '+
					'WHERE company_id=$1 AND vehicle_id=$2 AND poi_name=$3 ORDER BY status'
					, [company_id,vehicle_id,poi], function (err,result){
						if(err){

						}else{
							var activity=[];
							socket.request.session.vehicle_activity_poi_id=result[0].poi_id;
							for(var i=0;i<result.length;i++){
								delete result[i].poi_id;
								activity.push(result[i]);
							}
							socket.emit('vehicle_activity_poi_activity', activity);
							console.log(activity);
						}
		});				
	});
	/** Socket listener on event 'vehicle_activity_poi_newactivity' ->Add the new activity to the dedicated vehicle and poi
	*@typedef vehicle_activity_poi_newactivity
	*/
	socket.on('vehicle_activity_poi_newactivity', function (data){
		if(socket.request.session.vehicle_id && socket.request.session.vehicle_activity_poi_id){
			var vehicle_id=socket.request.session.vehicle_id;
			var company_id=socket.request.session.company_id_vehicle;
			var poi_id = socket.request.session.vehicle_activity_poi_id;
			var activity = data.activity.trim();
			console.log(activity);

			var d = new Date();
			var sdd = d.toISOString();
			var date = sdd.substring(0,10).replace(/-/gi,'');
			/** Selecting poi detatil for inserting the new activity to activity table. 
			*@typedef vehicle_activity_poi_newactivity
			*/
			db.select('SELECT name,detail,latitude,'+
						'longitude FROM poi WHERE id=$1'
						,[poi_id], function (err, result){
							if(err){

							}else{
								var poi_name=result[0].name;
								var poi_detail = result[0].detail;
								var poi_latitude = result[0].latitude;
								var poi_longitude = result[0].longitude;
								db.insert('INSERT INTO activity '+
									'(company_id,poi_id,vehicle_id,activity,date,poi_name,'+
									'poi_detail,poi_latitude,poi_longitude) '+
									'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)'
									,[company_id,poi_id,vehicle_id,activity,date,poi_name,poi_detail,poi_latitude,poi_longitude]);
							
							}
			});
		}else{

		}
	});

	/////////////////////vehicle and activity end/////////////////////

	////////////////////vehicle and dashboard/////////////////////////
	/** Socket listener on event 'vehicle_dashboard' -> sends fuel, speed data to the client based on request
	*@typedef vehicle_dashboard
	*/
	socket.on('vehicle_dasboard', function (data){
		if(!socket.request.session.vehicle_id){

		}else{
				console.log("vehicle dash_board with session");
				var from_date = data.from_date;
				var to_date = data.to_date;
				var type = data.type;
				var vehicle_id=socket.request.session.vehicle_id;
				var company_id=socket.request.session.company_id_vehicle;
				var device_id=socket.request.session.device_id;

				var d = new Date();
				var sdd = d.toISOString();
				var date = sdd.substring(0,10).replace(/-/gi,'');
				var year = date.substring(0,4);
				var month = date.substring(4,6);
				var day = date.substring(6);
				var previous_month;
				if(month==1){
					year=year-1;
					previous_month=12;
				}else{
					previous_month=month-1;
				}
				if(!from_date){
					from_date=year+previous_month+day;
				}
				if(!to_date){
					to_date=date;
				}
				console.log(from_date);
				console.log(to_date);
				if(type=="speed"){
					db.select('SELECT date,array_agg(time) AS time,'+
								'array_agg(speed) AS speed,array_agg(latitude) AS latitude,'+
								'array_agg(longitude) AS longitude '+
								'FROM vehicle_data WHERE device_id=$1 AND date BETWEEN '+
								'$2 AND $3 GROUP BY date ORDER BY date',
								[device_id,from_date,to_date], function (err,result){
									if(err){

									}else{
										//socket.emit('vehicle_dashboard_speed', result);
										console.log(result);
										if(result.length!=0){
											var i=0;
											(function sendSpeed(){
												if(i<result.length){
													var speed=[];
													var time=[];
													var latitude=[];
													var longitude=[];
													for(var j=0;j<result[i].speed.length;j++){
														if((j%(result.length*4))==0){
															speed.push(result[i].speed[j]);
															time.push(result[i].time[j]);
															latitude.push(result[i].latitude[j]);
															longitude.push(result[i].longitude[j]);
														}
													}
													result[i].time=time;
													result[i].speed=speed;
													result[i].latitude=latitude;
													result[i].longitude=longitude;
													i++;
													sendSpeed();
												}else{
													console.log(result);
													socket.emit('vehicle_dashboard_speed',result);
												}
											})();
										}

									}
					});

				}else if(type="fuel"){
					db.select('SELECT date,array_agg(time) AS time,'+
								'array_agg(fuel) AS fuel,array_agg(latitude) AS latitude,'+
								'array_agg(longitude) AS longitude '+
								'FROM vehicle_data WHERE device_id=$1 AND date BETWEEN '+
								'$2 AND $3 GROUP BY date ORDER BY date',
								[device_id,from_date,to_date], function (err,result){
									if(err){

									}else{
										//socket.emit('vehicle_dashboard_fuel', result);
										console.log(result);
										if(result.length!=0){
											var i=0;
											(function sendFuel(){
												if(i<result.length){
													var fuel=[];
													var time=[];
													var latitude=[];
													var longitude=[];
													for(var j=0;j<result[i].fuel.length;j++){
														if((j%(result.length*4))==0){
															fuel.push(result[i].fuel[j]);
															time.push(result[i].time[j]);
															latitude.push(result[i].latitude[j]);
															longitude.push(result[i].longitude[j]);
														}
													}
													result[i].time=time;
													result[i].fuel=fuel;
													result[i].latitude=latitude;
													result[i].longitude=longitude;
													i++;
													sendFuel();
												}else{
													console.log(result);
													socket.emit('vehicle_dashboard_fuel',result);
												}
											})();
										}	
									}
					});
				}else{
					db.select('SELECT date,array_agg(time) AS time,'+
								'array_agg(speed) AS speed,array_agg(fuel) AS fuel,array_agg(latitude)'+
								' AS latitude,array_agg(longitude) AS longitude '+
								'FROM vehicle_data WHERE device_id=$1 AND date BETWEEN '+
								'$2 AND $3 GROUP BY date ORDER BY date',
								[device_id,from_date,to_date], function (err,result){
									if(err){

									}else{
										//socket.emit('vehicle_dashboard', result);
										console.log(result);
										if(result.length!=0){
											var i=0;
											(function sendAll(){
												if(i<result.length){
													var speed=[];
													var fuel=[];
													var time=[];
													var latitude=[];
													var longitude=[];
													for(var j=0;j<result[i].fuel.length;j++){
														if((j%(result.length*4))==0){
															speed.push(result[i].speed[j]);
															fuel.push(result[i].fuel[j]);
															time.push(result[i].time[j]);
															latitude.push(result[i].latitude[j]);
															longitude.push(result[i].longitude[j]);
														}
													}
													result[i].time=time;
													result[i].speed=speed;
													result[i].fuel=fuel;
													result[i].latitude=latitude;
													result[i].longitude=longitude;
													i++;
													sendAll();
												}else{
													console.log(result);
													socket.emit('vehicle_dashboard_all',result);
												}
											})();
										}	
									}
					});
				}		
		}
	});

	///////////////////vehicle and dashboard/////////////////////////

////////////////////////////////vehicle ends/////////////////////////////////////	
	
///////////////////////////////poi///////////////////////////////////////////////
	/////////////////////////poi and map//////////////////////////////
	/** Socket listener on event 'poi_map_filter' ->filter the pois by using different filters.
	*@typedef poi_map_filter
	*/
	socket.on('poi_map_filter',function(data){
		var filter = data.filter.trim();
		var username = socket.request.session.user;
		if(filter=='A-Z'){
			db.select('SELECT poi.name,poi.detail,poi.latitude,poi.longitude FROM poi INNER JOIN '+
						'company_detail ON poi.company_id=company_detail.id WHERE company_detail.'+
						'username=$1 ORDER BY poi.name', [username], function (err, result){
							if(err){

							}else{
								if(result.length!=0){
									socket.emit('poi_map_filter',result);
								}
							}
			});
		}else if(filter=='Z-A'){
			db.select('SELECT poi.name,poi.detail,poi.latitude,poi.longitude FROM poi INNER JOIN '+
						'company_detail ON poi.company_id=company_detail.id WHERE company_detail.'+
						'username=$1 ORDER BY poi.name DESC', [username], function (err, result){
							if(err){

							}else{
								if(result.length!=0){
									socket.emit('poi_map_filter',result);
								}
							}
			});
		}else if(filter=='Most Visited'){
			db.select('SELECT activity.poi_name AS name, activity.poi_detail AS detail,'+
						'activity.poi_latitude AS latitude,activity.poi_longitude AS longitude '+
						'FROM activity INNER JOIN company_detail ON activity.company_id='+
						'company_detail.id WHERE company_detail.username=$1 GROUP BY activity.poi_name,'+
						'activity.poi_detail,activity.poi_latitude,activity.poi_longitude'+
						' ORDER BY COUNT(DISTINCT CONCAT(activity.poi_name,activity.date)) DESC',
						[username], function (err, result){
							if(err){

							}else{
								if(result.length!=0){
									console.log(result);
									socket.emit('poi_map_filter',result);
								}
							}
			});
		}else{
			db.select('SELECT poi.name,poi.detail,poi.latitude,poi.longitude '+
					 	'FROM poi INNER JOIN '+
						'company_detail ON poi.company_id=company_detail.id WHERE company_detail.'+
						'username=$1 ORDER BY date DESC', [username], function (err, result){
							if(err){

							}else{
								if(result.length!=0){
									socket.emit('poi_map_filter',result);
									console.log('poi_map_filter invoked');
								}
							}
			});
		}	
	});
	
	/** Socket listener on event 'poi'->sets the session for the poi
	*@typedef poi
	*/
	socket.on('poi', function (data){
		socket.request.session.poi_id_map='';
		socket.request.session.poi_name = ''
		var poi = data.poi;
		console.log(poi);
		var username = socket.request.session.user;
		db.select('SELECT poi.id'+
					' FROM poi INNER JOIN company_detail ON poi.company_id'+
					'=company_detail.id WHERE company_detail.username=$1 AND poi.name=$2',
					[username,poi], function (err, result){
						if(err){

						}else{
							socket.request.session.poi_id_map=result[0].id;
							socket.request.session.poi_name = poi;
							console.log(result)
						}
		});
	});
	/** Socket listener on event 'poi_map_detail' -> Send poi details to client
	*@typedef poi_map_detail
	*/
	socket.on('poi_map_detail', function (data){
		var poi_id = socket.request.session.poi_id_map;
		var username = socket.request.session.user;
		if(!poi_id){
			db.select('SELECT poi.name,poi.detail,poi.latitude,poi.longitude FROM poi '+
					'INNER JOIN company_detail ON poi.company_id=company_detail.id WHERE company_detail.username'+
					'=$1 ORDER BY poi.date DESC',[username], function (err, result){
						if(err){

						}else{
							socket.emit('poi_map_filter',result);	
							console.log(result);
						}
			});
		}else{
			db.select('SELECT poi.name,poi.detail,poi.latitude,poi.longitude '+
						'FROM poi WHERE poi.id=$1', [poi_id], function (err, result){
							if(err){

							}else{
								console.log(result);
								socket.emit('poi_map_detail',result);
							}
			});
		}
		
	});
	/** Socket listener on event 'poi_map_add' ->adds the poi
	*@typedef poi_map_add
	*/
	socket.on('poi_map_add', function (data){
		var poi_name = data.poi_name;
		console.log(poi_name);
		var poi_detail = data.poi_detail;
		var latitude = data.latitude;
		var longitude = data.longitude;
		var username = socket.request.session.user;
		var d = new Date();
		var sdd = d.toISOString();
		var date = sdd.substring(0,10).replace(/-/gi,'');

		if(poi_name && poi_detail){
			db.select('SELECT id FROM company_detail WHERE username=$1', [username], function (err, result){
				if(err){

				}else{
					var company_id = result[0].id;
					db.insert('INSERT INTO poi(name,detail,latitude,longitude,company_id,date) VALUES ($1,$2,$3,$4,$5,$6)',
						[poi_name,poi_detail,latitude,longitude,company_id,date]);
					console.log("poi addition success");
					socket.emit('poi_reload');
				}
			});
		}else{
			console.log("Enter the poi and detail field");
		}
	});
	///////////////////////poi and map ends////////////////////////////

	/////////////////////poi and activity///////////////////////////
	/** Socket listener on event 'poi_activity_detail', ->select the numver of activities grouped by date of the selected poi. 
	*@typedef poi_activity_detail
	*/
	socket.on('poi_activity_detail', function (data){
		var poi_id = socket.request.session.poi_id_map;
		var username = socket.request.session.user;
		db.select('SELECT date,COUNT(activity) FROM activity WHERE '+
				'poi_id=$1 GROUP BY date',[poi_id], function (err, result){
					if(err){

					}else{
						socket.emit('poi_activity_detail', result);
					}
		});
		db.select('SELECT vehicle.name FROM vehicle INNER JOIN company_detail ON '+
			'vehicle.company_id=company_detail.id WHERE company_detail.username=$1',
			[username], function (err, result){
				if(err){
					
				}else{
					socket.emit('vehicle_list', result);
				}
		});
	});
	/** Socket listener on event 'poi_activity_detail_activity'->Display the activity of the selected poi of the selected date 
	*@typedef poi_activity_detail_activity
	*/
	socket.on('poi_activity_detail_activity', function (data){
		socket.request.session.poi_activity_date='';
		var date = data.date;
		console.log(date);
		var username = socket.request.session.user;
		var poi_id = socket.request.session.poi_id_map;

		db.select('SELECT activity.activity,activity.status,'+
					'vehicle.name AS vehicle FROM activity LEFT OUTER JOIN vehicle ON activity.vehicle_id=vehicle.id '+
					'WHERE activity.date=$1 AND activity.poi_id=$2 ORDER BY status',
					[date,poi_id], function (err,result){
						if(err){

						}else{
							socket.request.session.poi_activity_date=date;
							console.log(result);
							socket.emit('poi_name', socket.request.session.poi_name);
							socket.emit('poi_activity_list',result);
						}
		});
	});
	/** Socket listener on event 'poi_activity_detail_filter'->filter the activity of the selected poi of the selected date.
	*@typedef poi_activity_detail_filter
	*/
	socket.on('poi_activity_detail_filter', function (data){
		var filter = data.filter.trim();
		console.log(filter);
		var username = socket.request.session.user;
		var poi_id = socket.request.session.poi_id_map;
		var date = socket.request.session.poi_activity_date;

		if(filter=='Not Assigned'){
			db.select('SELECT activity,status FROM activity '+
					'WHERE date=$1 AND poi_id=$2 AND vehicle_id IS NULL',
					[date,poi_id], function (err,result){
						if(err){

						}else{
							socket.emit('poi_activity_list',result);
						}
			});
		}else if(filter=='All'){
			db.select('SELECT activity.activity,activity.status,'+
					'vehicle.name AS vehicle FROM activity LEFT OUTER JOIN vehicle ON activity.vehicle_id=vehicle.id '+
					'WHERE activity.date=$1 AND activity.poi_id=$2 ORDER BY activity.status',
					[date,poi_id], function (err,result){
						if(err){

						}else{
							socket.emit('poi_activity_list',result);
						}
			});
		}else{
			db.select('SELECT activity.activity,activity.status,'+
					'vehicle.name AS vehicle FROM activity INNER JOIN vehicle ON activity.vehicle_id=vehicle.id '+
					'WHERE activity.date=$1 AND activity.poi_id=$2 AND vehicle.name=$3 ORDER BY status',
					[date,poi_id,filter], function (err,result){
						if(err){

						}else{
							socket.emit('poi_activity_list',result);
						}
			});
		}
	});
	/** Socket listener on event 'assign_activity_vehicle'->assign activity to particular vehicle
	*@typedef assign_activity_vehicle
	*/
	socket.on('assign_activity_vehicle', function (data){
		var activity = data.activity;
		var vehicle = data.vehicle.trim();
		if(vehicle!='Vehicle'){
			var username = socket.request.session.user;
			var poi_id = socket.request.session.poi_id_map;
			var date = socket.request.session.poi_activity_date;
			db.select('SELECT vehicle.id FROM company_detail '+
						'INNER JOIN vehicle ON company_detail.id=vehicle.company_id WHERE '+
						'company_detail.username=$1 AND vehicle.name=$2', 
						[username,vehicle], function (err, result){
							if(err){

							}else{
								var vehicle_id=result[0].id;
								db.update('UPDATE activity SET vehicle_id=$1 '+
								'WHERE poi_id=$2 AND date=$3 AND activity=$4',
								[vehicle_id,poi_id,date,activity]);
								socket.emit('reload_vehiclelist', {});
							}
			});
		}
	});
	/** Socket listener on event 'add_activity' ->adds new activity for the dedicated poi at th selected date.
	*@typedef add_activity
	*/
	socket.on('add_activity', function (data){
		if(socket.request.session.poi_id_map && socket.request.session.poi_activity_date){
			var activity = data.activity;
			if(activity){
				var username = socket.request.session.user;
				var poi_id = socket.request.session.poi_id_map;
				var date = socket.request.session.poi_activity_date;
				db.select('SELECT name,detail,latitude,longitude,company_id '+
							'FROM poi WHERE id=$1', [poi_id], function (err, result){
								if(err){

								}else{
									var poi_name = result[0].name;
									var poi_detail = result[0].detail;
									var poi_latitude = result[0].latitude;
									var poi_longitude = result[0].longitude;
									var company_id = result[0].company_id;
									db.insert('INSERT INTO activity(company_id,poi_id,'+
										'activity,date,poi_name,poi_detail,poi_latitude,poi_longitude) '+
										'VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
										[company_id,poi_id,activity,date,poi_name,poi_detail,
										poi_latitude,poi_longitude]);
									socket.emit('reload_vehiclelist', {});
								}
				});
			}else{
				console.log('activity empty');
			}
			
		}
	});
	/////////////////////poi and activity ends///////////////////////
///////////////////////////poi ends///////////////////////////////////////////////
	/** Socket listener on event 'disconnect'-> clear all the socket session 
	*@typedef disconnect
	*/
	socket.on('disconnect', function(){
		socket.request.session.vehicle_id='';
		socket.request.session.company_id_vehicle = '';
		socket.request.session.device_id ='';
		socket.request.session.vehicle_activity_poi_id='';
		socket.request.session.poi_id_map='';
		socket.request.session.poi_activity_date='';
		socket.request.session.poi_name = ''
	});
});

////////////////////////////// socket.io end ///////////////////////////////////

http.listen(3000, function(){
	console.log('listening on *: ' + 3000);
});



//////////////////// Functions below this line //////////////////////////////////

setInterval(pinExpiry, 120000);
/** Deletes the record from user_pin, device_pin older than 1 hour 
*/
function pinExpiry(){
	db.delet("DELETE FROM user_pin WHERE timestamp<NOW()-INTERVAL '1 hour'");
	db.delet("DELETE FROM device_pin WHERE timestamp<NOW()-INTERVAL '1 hour'");
}

/** It sends the mail to theemail provided
*@param {string} email - The email of the receiver
*@param {string} subjects - The subjects of the of the email
*@param {string} htmls - The format of the email
*/
function sendMail(email, subjects, htmls){
	var mailOptions = {
	    from: 'Maulik Taranga<sender@mail.com>',
	    to: email,
	    subject: subjects,
	    html: htmls
	};
	smtpTransport.sendMail(mailOptions, function(err) {
  		console.log('Message sent!');
	});
}
// populateVehicleData();
function populateVehicleData(){
	var i=0;
	var latitude=27.69161;
	var longitude=85.32936;
	var date='20151218';
	var time='024430';
	var deviceid=3;
	var minute;
	var hour;
	(function populate(){
		if(i<50){
			latitude=latitude+0.002;
			var strlatitude=latitude.toString().slice(0,8);
			console.log(strlatitude);
			longitude=longitude+0.002;
			var strlongitude = longitude.toString().slice(0,8);
			console.log(strlongitude);
			minute=parseInt(time.slice(2,4))+2;
			hour = parseInt(time.slice(0,2));
			minute=minute.toString();
			hour=hour.toString();
			var fuel = Math.floor(Math.random()*100);
			var speed = Math.floor(Math.random()*100);
			if(minute>60){
				minute=0;
				hour = hour+1;
			}
			if(hour.length!=2){
				hour = '0'+hour;
			}
			if(minute.length!=2){
				minute = '0'+minute;
			}
			time=hour+minute+time.slice(4,6);

			db.insert('INSERT INTO vehicle_data(latitude,longitude,fuel,speed,date,time,device_id) '+
				'VALUES ($1,$2,$3,$4,$5,$6,$7)',[strlatitude,strlongitude,fuel,speed,date,time,deviceid]);
			i++;
			populate();
		}else{
			console.log('finished. change date');

		}
	})();
}

// sendMail('+9779841559663@vtext.com', 'Hello', "what's up man?");
//sendMail('sp.gharti@gmail.com', 'Hello', "what's up man?");


////////////////////////////////Testing Here///////////////////////////////

// var pin_expiry_client = new pg.Client(db_connection);
// pin_expiry_client.connect(function (err){
// 	if(err){
// 		console.log('Could not connect to postgres on pin expiry', err);
// 	}
// 	console.log("pin expiry db connection successful");
// 	pin_expiry_client.query('SELECT date,array_agg(time) AS time,array_agg(speed) AS speed, '+
// 		'array_agg(latitude) AS latitude,array_agg(longitude) AS longitude '+
// 		'FROM vehicle_data WHERE device_id=$1 GROUP BY date ORDER BY date', [3],function (err,result){
// 		if(err){
// 			console.log('error running select date  on user_pin expiry', err);
// 			pin_expiry_client.end();
// 		}
// 		else{
// 			console.log(result.rows);
// 		}
// 	});
// });
