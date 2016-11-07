//https://github.com/angular-ui/ui-select/issues/258
app.directive('uiSelectRequired', function() {
  return {
    require: 'ngModel',
    link: function(scope, elm, attrs, ctrl) {
      ctrl.$validators.uiSelectRequired = function(modelValue, viewValue) {
        //return modelValue && modelValue.length;
        return modelValue != "";
      };
    }
  };
});

/*
//stores inventory of all tasks (updated by PageController through WebSocket)
app.factory('tasks', function(appconf, $http, jwtHelper, toaster) {
    var tasks = {};
    return tasks;
});
*/

app.directive('uploadingStatus', function() {
  return {
    templateUrl: 't/uploading_status.html',
    scope: { detail: '<', tasks: '=' },
    controller: function($scope) {
        console.log("init uploading status");
    }
  };
});

app.directive('taskstatus', function() {
    return {
        template: '<span class="label" ng-class="c">{{status|uppercase}}</span>',
        scope: { status: '<' },
        controller: function($scope) {
            $scope.$watch('status', function() {
                switch($scope.status) {
                case "requested":
                    $scope.c = "label-info"; break;
                case "running":
                case "running_sync":
                    $scope.c = "label-primary"; break;
                case "failed":
                    $scope.c = "label-danger"; break;
                case "finished":
                    $scope.c = "label-success"; break;
                default:
                    $scope.c = "label-warning";
                }
            });
        }
    }
});

app.directive('transferUi', function(appconf, toaster, $http) {
    return {
        templateUrl: 't/transferui.html',
        scope: { 
            form: '=',
            instance: '=',
            resources: '=',
            tasks: '=',
            id: '<',
            ngfpattern: '<',
        },
        link: function($scope, element, attrs) {

            //remove date used to submit various services
            var remove_date = new Date();
            remove_date.setDate(remove_date.getDate()+14); //remove in 14 day (long enough for large job?)

            $scope.remove = function(id) {
                var processing = $scope.form.processing[id];
                if(processing.xhr) {
                    processing.xhr.abort();
                }
                if(processing.download_task_id) {
                    //TODO - submit job cancel
                }
                delete $scope.form.processing[id];
                delete $scope.form[id];
            }

            $scope.download = function(url, type) {
                var tokens = url.split("/");
                var filename = tokens[tokens.length-1]; //grab last
                var processing = {
                    url: url,
                    name: filename,
                    type: type,
                };
                $scope.form.processing[type] = processing;

                //submit transfer request first
                $http.post(appconf.wf_api+"/task", {
                    instance_id: $scope.instance._id,
                    name: "downloading",
                    desc: "downloading "+url,
                    service: "soichih/sca-product-raw",
                    remove_date: remove_date,
                    config: {
                        download: [ 
                            {
                                url: url,
                                dir: "./",
                            }
                        ]
                    },
                })
                .then(function(res) {
                    processing.download_task_id = res.data.task._id;
                    //processing.validation_src = "../"+processing.download_task_id+"/"+filename;
                    //console.dir(res);
                }, function(res) {
                    console.log("TODO - download request submit error");
                });
            }

            $scope.upload = function(file, type) {
                if(!file) {
                    return toaster.error("Please select a correct file type");
                }
                var path = $scope.instance._id+"/upload/"+file.name;
                var processing = {
                    name: file.name,
                    size: file.size,
                    //filetype: file.type,
                    type: type,
                    progress: 0,
                    //validation_src: "../upload/"+file.name
                };
                $scope.form.processing[type] = processing;

                //console.log("uploading to:"+path);
                //console.dir($scope.resources);

                //do upload
                var xhr = new XMLHttpRequest();
                processing.xhr = xhr; //so that I can abort it
                xhr.open("POST", appconf.wf_api+"/resource/upload/"+$scope.resources.upload._id+"/"+btoa(path));
                var jwt = localStorage.getItem(appconf.jwt_id);
                xhr.setRequestHeader("Authorization", "Bearer "+jwt);
                xhr.upload.addEventListener("progress", function(evt) {
                    //console.log("process");
                    //console.dir(evt);
                    $scope.$apply(function() {
                        processing.progress = evt.loaded / evt.total;
                    });
                }, false);
                xhr.addEventListener("load", function(evt) {
                    //console.log("uploaded");
                    $scope.$apply(function() {
                        delete processing.progress;
                    });
                    processing.done = true;
                    $scope.form[type] = "../upload/"+file.name;
                    //submit_validation(processing);
                }, false);

                //all set..
                xhr.send(file);
            }

            /*
            function submit_validation(processing) {
                //submit validation
                $http.post(appconf.wf_api+"/task", {
                    instance_id: $scope.instance._id,
                    name: "data validation "+processing.type,
                    desc: "validating "+processing.name,

                    //TODO - run validation and copy to a bit more permanent location
                    service: "soichih/sca-product-raw",
                    remove_date: remove_date,
                    config: {
                        symlink: [ 
                            {
                                src: processing.validation_src,
                                dest: processing.name,
                            }
                        ]
                    },
                    //deps: deps,
                })
                .then(function(res) {
                    processing.validate_task_id = res.data.task._id;
                }, function(res) {
                    console.log("TODO - validation request submit error");
                });
            }
            */

            //detect task finish
            $scope.$on('task_updated', function(evt, task) {
                ['dwi', 'bvecs', 'bvals', 't1', 'bids'].forEach(function(type) {
                    var processing = $scope.form.processing[type];
                    if(!processing) return; //don't care if we don't have
                    if(task._id == processing.download_task_id) {
                        if(task.status == "finished") {
                            //handle download end
                            if(!processing.url) return; //downlaod complete already handled
                            delete processing.url;
                            //console.log("done download");
                            //console.dir(task.products[0]);
                            processing.done = true;
                            $scope.form[type] = "../"+task._id+"/"+processing.name;
                            //submit_validation(processing);
                        }
                        if(task.status == "failed") {
                            delete $scope.form.processing[type];
                            delete $scope.form[type];
                            toaster.error("Failed to download the file specified. Please check the URL and try again");
                        }
                    }
                });
            });
        }
    }
});

app.directive('submitdetail', function() {
    return {
        templateUrl: 't/submitdetail.html',
        scope: { detail: '<' },
        controller: function($scope) {
        }
    }
});

app.directive('lifeplot', function(appconf, $http) {
    return {
        templateUrl: 't/lifeplot.html',
        scope: { task: '<' },
        link: function(scope, element, attrs) {
            scope.$watch('task', function() {
                //console.log("detected task update - lifeplot");
                if(scope.task.status == "finished" && !element.loaded) {
                    element.loaded = true;
                    //load life_results.json
                    var path = encodeURIComponent(scope.task.instance_id+"/"+scope.task._id+"/life_results.json");
                    //var jwt = localStorage.getItem(appconf.jwt_id);
                    $http.get(appconf.wf_api+"/resource/download?r="+scope.task.resource_id+"&p="+path)
                    .then(function(res) {
                        if(scope.destroyed) return; 

                        //console.log("life_results.json");
                        //console.dir(res.data);
                        var rmse = res.data.out.plot[0];
                        var w = res.data.out.plot[1];
                        scope.plot_life_rmse_title = rmse.title;
                        scope.plot_life_w_title = w.title;
                        Plotly.plot('plot_life_rmse', [{
                            x: rmse.x.vals,
                            y: rmse.y.vals,
                            //y: rmse, 
                            //type: 'histogram', 
                            //marker: { color: 'blue', }
                        }], {
                            //title: rmse.title,
                            xaxis: {title: rmse.x.label},
                            yaxis: {title: rmse.y.label},
                            margin: {t: 0, b: 35, r: 0},
                        });

                        Plotly.plot('plot_life_w', [{
                            x: w.x.vals,
                            y: w.y.vals,
                            //y: rmse, 
                            //type: 'histogram', 
                            //marker: { color: 'blue', }
                        }], {
                            //title: w.title,
                            xaxis: {title: w.x.label},
                            yaxis: {title: w.y.label},
                            margin: {t: 0, b: 35, r: 0},
                        });
                    });
                    
                    element.on('$destroy', function() {
                        scope.destroyed = true;
                    });
                }
            });
        }
    }
});

//allows me to reuse vtk model already loaded (or loading)
app.factory('vtk', function($q, appconf) {

    var cache = {};//cache of promises

    return {
        get: function(path) {
            if(cache[path]) return cache[path];

            //never loaded before.. create a new promise
            var promise = $q(function(resolve, reject) {
                console.log("loading vtk model for the first time "+path); 
                var loader = new THREE.VTKLoader();
                var p = encodeURIComponent(path);
                var jwt = localStorage.getItem(appconf.jwt_id);
                loader.load(path, function(geometry) {
                    geometry.computeFaceNormals();
                    geometry.computeVertexNormals();
                    resolve(geometry);
                }, function(progress) {}, reject);
            });
            cache[path] = promise;
            return promise;
        }
    }
});

app.directive('comparisonplot', function(appconf, $http, vtk) {
    return {
        templateUrl: 't/comparisonplot.html',
        scope: { task: '<', },
        link: function(scope, element, attrs) {
            element.on('$destroy', function() {
                scope.destroyed = true;
            });
    
            load_nnz(function(err, data) {
                Plotly.plot('plot_compare', data, {
                    xaxis: {title: "Connectome Error (r.m.s.e.)"},
                    yaxis: {title: "Fascicles Number"},
                    margin: {t: 20, l: 50, b: 35}, //, l: 30, r:10, b:30},
                    background: '#f00',
                });
            });
            
            function load_nnz(cb) {
                //load out.json (should move nnz / rmse to products.json?)
                var path = encodeURIComponent(scope.task.instance_id+"/"+scope.task._id+"/out.json");
                $http.get(appconf.wf_api+"/resource/download?r="+scope.task.resource_id+"&p="+path)
                .then(function(res) {
                    if(scope.destroyed) return;
                    //console.log("out.json");
                    //console.dir(res.data);
                    var ref = res.data.reference;
                    scope.nnz = res.data.nnz;
                    scope.rmse = res.data.rmse;

                    var data = [];
                    var gid = 0;
                    ["HCP3T", "STN", "HCP7T"].forEach(function(group) {
                        var subgid = 0;
                        //["Deterministic", "Probabilistic", "XXX", "Tensor1", "Tensor2"].forEach(function(subgroup) {
                        ["Subj1", "Subj2", "Subj3", "Subj4"].forEach(function(subgroup) {
                            data.push({
                                mode: 'markers',
                                name: group+' - '+subgroup,
                                x: ref.rmse[gid].mean[subgid],
                                y: ref.nnz[gid].mean[subgid],
                                error_x: {
                                    array: ref.rmse[gid].std[subgid],
                                    thickness: 0.5,
                                    width: 1,
                                },
                                error_y: {
                                    array: ref.nnz[gid].std[subgid],
                                    thickness: 0.5,
                                    width: 1,
                                },
                                marker: {
                                    sizemode: 'area',
                                    size: 10, //ref.rmse[0].std.map(function(v) { return v*10000000}),
                                    opacity: 0.5,
                                    color: 'hsl('+gid*60+', '+(100-(subgid*25+25))+'%, 30%)',
                                }
                            });
                            subgid++;
                        });
                        gid++;
                    });

                    data.push({
                        mode: 'markers',
                        name: 'Yours',
                        x: [res.data.rmse],
                        y: [res.data.nnz],
                        marker: {
                            sizemode: 'area',
                            size: 20, 
                            opacity: 0.8,
                            color: '#008cba',
                        }
                    });
                    cb(null, data);
                });
            }

        }
    }
});

app.directive('tractsview', function(appconf, $http, vtk) {
    return {
        templateUrl: 't/tractsview.html',
        scope: { task: '<', freesurfer: '<' },
        link: function(scope, element, attrs) {
            element.on('$destroy', function() {
                scope.destroyed = true;
            });
    
            init_conview();
            function init_conview() {
                var view = $("#conview");
                var renderer = new THREE.WebGLRenderer({alpha: true/*, antialias: true*/});

                //scenes - back scene for brain siluet
                var scene_back = new THREE.Scene();
                //scene_back.background = new THREE.Color(0x333333);
                var scene = new THREE.Scene();
                
                //camera
                var camera = new THREE.PerspectiveCamera( 45, view.width() / view.height(), 1, 5000);
                camera.position.z = 200;

                //light for back
                //var camlight = new THREE.PointLight(0xFFFFFF);
                //camlight.position.copy(camera.position);
                //scene_back.add(camlight);

                //load vtk brain model from freesurfer
                var rid = scope.freesurfer.resource_id;
                var jwt = localStorage.getItem(appconf.jwt_id);

                //load left
                var base = scope.freesurfer.instance_id+"/"+scope.freesurfer._id;
                var path = encodeURIComponent(base+"/lh.10.vtk");
                vtk.get(appconf.wf_api+"/resource/download?r="+rid+"&p="+path+"&at="+jwt).then(function(geometry) {
                    //var material = new THREE.MeshLambertMaterial({color: 0xffcc99, transparent: true, opacity: 0.5});
                    var material = new THREE.MeshBasicMaterial();
                    var mesh = new THREE.Mesh( geometry, material );
                    mesh.rotation.x = -Math.PI/2;
                    scene_back.add(mesh);
                });
                //load right
                var path = encodeURIComponent(base+"/rh.10.vtk");
                vtk.get(appconf.wf_api+"/resource/download?r="+rid+"&p="+path+"&at="+jwt).then(function(geometry) {
                    //var material = new THREE.MeshLambertMaterial({color: 0xffcc99, transparent: true, opacity: 0.5});
                    var material = new THREE.MeshBasicMaterial();
                    var mesh = new THREE.Mesh( geometry, material );
                    mesh.rotation.x = -Math.PI/2;
                    scene_back.add(mesh);
                });
                
                //load sample tracks (TODO - load from real life output eventually)
                for(var i = 1;i < 21;++i) {
                    load_tract("tracts/tracts_110411/tracts."+i+".json", function(err, mesh) {
                        scene.add(mesh);
                    });
                }

                renderer.autoClear = false;
                renderer.setSize(view.width(), view.height());
                view.append(renderer.domElement);

                //use OrbitControls and make camera light follow camera position
                var controls = new THREE.OrbitControls(camera, renderer.domElement);
                controls.addEventListener('change', function() {
                    //camlight.position.copy(camera.position);
                });
                animate_conview();
                function animate_conview() {
                    //stats.begin();

                    renderer.clear();
                    renderer.render( scene_back, camera );
                    renderer.clearDepth();
                    renderer.render( scene, camera );

                    //stats.end();

                    requestAnimationFrame( animate_conview );
                }
            }
            
            function load_tract(path, cb) {
                console.log("loading tract "+path);
                //$scope.loading = true;
                $http.get(path)
                .then(function(res) {
                    if(scope.destroyed) return;

                    var name = res.data.name;
                    var color = res.data.color;
                    var bundle = res.data.coords;

                    var threads_pos = [];
                    //bundle = [bundle[0]];
                    bundle.forEach(function(fascicle) {

                        var xs = fascicle[0][0];
                        var ys = fascicle[0][1];
                        var zs = fascicle[0][2];

                        for(var i = 1;i < xs.length;++i) {
                            threads_pos.push(xs[i-1]);
                            threads_pos.push(ys[i-1]);
                            threads_pos.push(zs[i-1]);
                            threads_pos.push(xs[i]);
                            threads_pos.push(ys[i]);
                            threads_pos.push(zs[i]);
                        }
                    });

                    //now show bundle
                    var vertices = new Float32Array(threads_pos);
                    var geometry = new THREE.BufferGeometry();
                    geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3 ) );
                    var material = new THREE.LineBasicMaterial( {
                        color: new THREE.Color(color[0], color[1], color[2]),
                        transparent: true,
                        opacity: 0.7,
                        //fog: true,
                        //blending: THREE.NormalBlending,
                        //depthTest: true,
                        //depthWrite: true,
                        //linewidth: 3 ,
                    } );
                    var mesh = new THREE.LineSegments( geometry, material );
                    mesh.rotation.x = -Math.PI/2;
                    //
                    //temporarly hack to fit fascicles inside
                    mesh.position.z = -20;
                    mesh.position.y = -20;

                    cb(null, mesh);
                });
            }
        }
    }
});

app.directive('vtkview', function(appconf, $http, vtk) {
    return {
        template: '',
        scope: { 
            url: '<',
            resourceid: '<' 
        },
        link: function(scope, element, attrs) {
            //console.dir(element.height());

            var width = 400;
            var height = 300;

            //scene
            var scene = new THREE.Scene();
            //scene.background = new THREE.Color(0x333333);
            var scene_front = new THREE.Scene();

            //renderer
            var renderer = new THREE.WebGLRenderer({alpha: true/*, antialias: true*/});
            //renderer.setSize(element.width(), element.height());
            renderer.autoClear = false;
            renderer.setSize(width, height);
            element.append(renderer.domElement);

            //camera
            var camera = new THREE.PerspectiveCamera( 45, width / height, 1, 5000);
            camera.rotation.x = Math.PI/2;
            camera.position.z = 200;
            
            //light
            var ambLight = new THREE.AmbientLight(0x303030);
            scene.add(ambLight);
            var directionalLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
            directionalLight.position.set( 0, 1, 0 );
            scene.add( directionalLight );
            var camlight = new THREE.PointLight(0xFFFFFF);
            camlight.position.copy(camera.position);
            scene.add(camlight);

            //axishelper
            var axisHelper = new THREE.AxisHelper(50);
            scene_front.add(axisHelper);
           
            //control & animate
            var controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.addEventListener('change', function() {
                camlight.position.copy(camera.position);
            });
            function animate() {
                requestAnimationFrame( animate );

                renderer.clear();
                renderer.render( scene, camera );
                renderer.clearDepth();
                renderer.render( scene_front, camera );

                controls.update();
            } 
            animate();

            var p = encodeURIComponent(scope.url);
            var jwt = localStorage.getItem(appconf.jwt_id);
            vtk.get(appconf.wf_api+"/resource/download?r="+scope.resourceid+"&p="+p+"&at="+jwt).then(function(geometry) {
                var material = new THREE.MeshLambertMaterial( { color: 0xcc9966 } );
                var mesh = new THREE.Mesh( geometry, material );
                mesh.rotation.x = -Math.PI/2;
                scene.add( mesh );
            });
        }
    }
});


