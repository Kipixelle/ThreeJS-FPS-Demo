import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { SAOPass } from 'three/addons/postprocessing/SAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// -- Scene and objects --
let stats;                        // Display FPS on the screen
let scene, camera;                // Scene and camera
let flashlight, flashlightHelper; // Spotlight for the flashlight and its helper

let gltfModel;                                   // GLTF model of the scene
let flashlightModel;                             // GLTF model for the flashlight
let gltfIsLoading = false;                       // Boolean to determine if some GLTF are loading or not
let loadingManager = new THREE.LoadingManager(); // Loading manager for the gltfLoader and rgbeLoader
let gltfLoader = new GLTFLoader(loadingManager); // Loader for the GLTF use in the app
let rgbeLoader = new HDRLoader(loadingManager);  // Loader for the HDR use in the app

// -- Post process and renderer --
let composer, bloomPass; // Composer for the post process, BloomPass
let renderer;            // Renderer

// -- FPS Camera control --
let moveForward = false;  // Key W
let moveBackward = false; // Key S
let moveLeft = false;     // Key Q
let moveRight = false;    // Key D
let moveUp = false;       // Key Space
let moveDown = false;     // Key Shift

const velocity = new THREE.Vector3();  // FPS camera velocity
const direction = new THREE.Vector3(); // FPS camera direction

let pitch = 0;              // FPS camera pitch
let yaw = 0;                // FPS camera yaw
const sensitivity = 0.002;  // FPS camera sensitivity
const speed = 6.0;          // FPS camera speed

// -- Mouse and control --
let closeEl = initCloseBtn(); // Close button HTML element
document.addEventListener( 'mousedown', onDocumentMouseDown, false ); // Function to close the app (even without the frame buttons) when launch with NW.js as an exe

let clock = new THREE.Clock();

// -- Areas movement system --
let useAreas = false; // Bolean to define if use areas constraint to move the FPS camera
let areasMovement = [];       // Array to store the THREE.Box2 representing areas restricting movement for FPS camera
let areasMovementHelper = []; // Array to store the THREE.Line to display helpers for areas
const areaInHelperMat = new THREE.LineBasicMaterial({color: 0x32a852});  // Color of area helper when camera in (green)
const areaOutHelperMat = new THREE.LineBasicMaterial({color: 0xa33e33}); // Color of area helper when camera out (red)

init();   // Init the app
render(); // Render the app

// --- Camera FPS functions ---
function initMouseAndKeyboardForFPSCamera(container){
    // Mouse lock
    container.addEventListener('mousedown', () => {
        document.body.requestPointerLock();
    });

    // Mouse look
    document.body.addEventListener('mousemove', (event) => {
        if (document.pointerLockElement === document.body && !gltfIsLoading){
            yaw -= event.movementX * sensitivity;
            pitch -= event.movementY * sensitivity;
            pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
        }
    });

    // Keyboard
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
}

function onKeyDown(event) {
    // Set FPS camera control when key down (do movement)
    switch (event.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyD': moveRight = true; break;
        case 'Space': moveUp = true; break;
        case 'ShiftLeft': moveDown = true; break;
    }
}

function onKeyUp(event) {
    // Set FPS camera control when key up (stop movement)
    switch (event.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyD': moveRight = false; break;
        case 'Space': moveUp = false; break;
        case 'ShiftLeft': moveDown = false; break;
    }
}

function getNewCameraPos(delta){
    // Update the FPS camera position 
    let newCameraPos = camera.position.clone();

    velocity.set(0, 0, 0);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    direction.set(0, 0, -1).applyEuler(camera.rotation);

    const right = new THREE.Vector3().crossVectors(direction, camera.up).normalize();

    if (moveForward) velocity.add(direction);
    if (moveBackward) velocity.sub(direction);
    if (moveLeft) velocity.sub(right);
    if (moveRight) velocity.add(right);
    if (moveUp) velocity.y += 1;
    if (moveDown) velocity.y -= 1;

    if (velocity.lengthSq() > 0) {
        velocity.normalize().multiplyScalar(speed * delta);
        newCameraPos.add(velocity);
    }

    return newCameraPos;
}

function createCameraPath(){
    // Create the restricted movement areas datas
    let boundingAreas = [
        [new THREE.Vector2(-3.5, -3), new THREE.Vector2(3, 4)],
        [new THREE.Vector2(-4, 4), new THREE.Vector2(-2, 7)],
    ]

    for (let i = 0; i < boundingAreas.length; i++){
        const bz = boundingAreas[i];
        // Create a Box2 corresponding to the area and add it to areas
        const min = bz[0];
        const max = bz[1];
        let box2 = new THREE.Box2(min, max);
        areasMovement.push(box2);

        // Create visual helper for the area and add it to areasMovementHelper
        const points = [];
        points.push( new THREE.Vector3( min.x, 0.01, min.y ) );
        points.push( new THREE.Vector3( min.x, 0.01, max.y ) );
        points.push( new THREE.Vector3( max.x, 0.01, max.y ) );
        points.push( new THREE.Vector3( max.x, 0.01, min.y ) );
        points.push( new THREE.Vector3( min.x, 0.01, min.y ) );

        const geometry = new THREE.BufferGeometry().setFromPoints( points );

        const line = new THREE.Line( geometry, areaOutHelperMat );
        scene.add( line );
        areasMovementHelper.push(line);

        console.log("area created")
    }
}

function cameraInArea(newCameraPos){
    // Check if the next FPS camera position is in an area that allow movement and set the areas visual helper (in red or green)
    // Return a boolean to define if the FPS camera is allowed to move or not
    let updateCamera = false;
    for (let i = 0; i < areasMovement.length; i++){
        const areaBox2 = areasMovement[i];
        const areaLine = areasMovementHelper[i];
        if (areaBox2.containsPoint(new THREE.Vector2(newCameraPos.x, newCameraPos.z))){
            areaLine.material = areaInHelperMat;
            updateCamera = true;
        } else{
            areaLine.material = areaOutHelperMat;
        }
    }
    return updateCamera;
}

// --- Light functions ---
function createSpotlight(position, target){
    // Create a static spotlight and add it to the scene
    const spotLight = new THREE.SpotLight( 0xffffff, 50 );
    spotLight.position.set( 2.5, 5, 2.5 );
    spotLight.angle = Math.PI / 5;
    spotLight.penumbra = 1;
    spotLight.decay = 2;
    spotLight.distance = 0;

    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 1024;
    spotLight.shadow.mapSize.height = 1024;
    spotLight.shadow.camera.near = 1;
    spotLight.shadow.camera.far = 10;
    spotLight.shadow.focus = 1;

    spotLight.target.position.set(target.x, target.y, target.z)
    spotLight.position.set(position.x, position.y, position.z)

    scene.add( spotLight );
    scene.add( spotLight.target );
}

function createFlashlight(){
    // Create the spotlight for the flashlight
    flashlight = new THREE.SpotLight( 0xffffff, 50 );
    flashlight.castShadow = true;
    flashlight.shadow.mapSize.width = 1024;
    flashlight.shadow.mapSize.height = 1024;
    flashlight.shadow.camera.near = 0.1;
    flashlight.shadow.camera.far = 20;

    flashlight.distance = 40;
    flashlight.decay = 1.15;
    flashlight.angle = Math.PI/8;
    flashlight.penumbra = 0.3;

    // Create the spotlight helper for the flashlight
    flashlightHelper = new THREE.SpotLightHelper( flashlight );
    flashlightHelper.visible = false;
    scene.add( flashlightHelper );
}

function linkFlashlightToModel(){
    // Add spotlight to flashlight model
    flashlightModel.add( flashlight );
    flashlight.position.set(-0.25, 0, 0);

    // Create and add the spotlight targer
    const flashlightTarget = new THREE.Object3D();
    flashlightModel.add(flashlightTarget);
    flashlightTarget.position.set(-100, 0, 0);
    flashlight.target = flashlightTarget;

    // Add the flashlight model to the camera and set position/rotation
    camera.add( flashlightModel );
    flashlightModel.position.set( 0.5, -0.2, -0.5);

    flashlightModel.setRotationFromEuler(new THREE.Euler(0, -90*Math.PI/180, 0));
}

function loadScene(gltfName){
    // Load a GLTF as the main scene
    if (gltfModel != null){
        gltfModel.removeFromParent();
        gltfModel = null;
    }

    gltfLoader.load( gltfName, function ( gltf ) {
        gltfModel = gltf.scene
        gltfModel.traverse ( function ( child )
        {
            if ( child.isMesh )
            {
                child.castShadow = true;
                child.receiveShadow = true;
                child.material.side = 0;
            }
        });

        scene.add( gltfModel );

    }, undefined, function ( error ) {
        console.error( error );
    });
}

function loadFlashlight(){
    // Load the flashlight GLTF model
    gltfLoader.load( "flashlight/flashlight.gltf", function ( gltf ) {
        flashlightModel = gltf.scene
        flashlightModel.traverse ( function ( child )
        {
            if ( child.isMesh )
            {
                child.castShadow = true;
                child.receiveShadow = true;
                child.material.side = 0;
            }
        });

        scene.add( flashlightModel );

        linkFlashlightToModel();

    }, undefined, function ( error ) {
        console.error( error );
    });
}

function init() {
    const container = document.getElementById( 'container' );

    // Params used for GUI
    const params = {
        flashlightActive : true,
        flashlightHelperActive: false,
        exposure: 1.0,
        modelName : "Garage",
        useAreas: false
    }

    // --- Renderer ---
    renderer = new THREE.WebGLRenderer();
    renderer.physicallyCorrectLights = true;     // PBR enabled
    renderer.outputEncoding = THREE.sRGBEncoding; // PBR RGB workflow
    
    renderer.setSize( window.innerWidth, window.innerHeight );

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;

    container.appendChild( renderer.domElement );

    // Show fps
    stats = new Stats();
    container.appendChild( stats.dom );

    // --- Scene ---
    scene = new THREE.Scene();

    // --- Camera ---
    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    camera.position.set(1, 1, 1);
    scene.add( camera );

    // --- Light ---
    const posA = new THREE.Vector3(1, 4.3, -1.8)
    const targetA = new THREE.Vector3(-1, 0, -1.8)
    createSpotlight(posA, targetA);

    const pointLight1 = new THREE.PointLight( 0xffffff, 0.1, 8, 0 );
    pointLight1.position.set( 0, 0.1, 2 );
    scene.add( pointLight1 );

    createFlashlight();

    // -- Loader manager with progress bar --
    const progressBar = document.getElementById('progress-bar');
    const progressBarContainer = document.querySelector('.progress-bar-container');

    loadingManager.onStart = function (url, itemsLoaded, total) {
        console.log('Loading process has started!');
        const progressBarContainer = document.querySelector('.progress-bar-container');
        const progressBar = document.getElementById('progress-bar');
        gltfIsLoading = true;
        progressBar.value = 0;
        progressBarContainer.style.visibility = 'visible';
    };

    loadingManager.onProgress = function (url, loaded, total) {
        progressBar.value = (loaded / total) * 100;
    };

    loadingManager.onLoad = async function () {
        await renderer.compileAsync( gltfModel, camera, scene );
        console.log('Loading process has been completed!');
        gltfIsLoading = false;
        progressBarContainer.style.visibility = 'hidden';
    };

    // -- Load HDR and scene --
    rgbeLoader = new HDRLoader(loadingManager);
    rgbeLoader.setPath('./probes/');
    rgbeLoader.load('garage_blender.hdr', function (texture, textureData) {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        // Apply it both as environment and background
        scene.environment = texture;
        scene.background = new THREE.Color(0x0000);
        console.log('HDR loaded!');

        loadScene('garage/garage.gltf');
        loadFlashlight();
    });

    // -- Init mouse / keyboard controls --
    initMouseAndKeyboardForFPSCamera(container);

    // --- FPS Camera areas movement ---
    createCameraPath()

    // --- Post Process ---
    const renderPass = new RenderPass(scene, camera);

    // SSAO
    const ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
    ssaoPass.kernelRadius = 6;      // Taille du rayon d'occlusion
    ssaoPass.minDistance = 0.0001;   // Distance minimale de calcul
    ssaoPass.maxDistance = 0.1;     // Distance maximale

    const saoPass = new SAOPass( scene, camera );
    saoPass.params.saoBias = -1;
    saoPass.params.saoIntensity = 0.009;
    saoPass.params.saoScale = 10;
    saoPass.params.saoKernelRadiux = 62;
    saoPass.params.saoMinResolution = 0;
    saoPass.params.saoBlur = true;
    saoPass.params.saoBlurRadius = 5.8;
    saoPass.params.saoBlurStdDev = 2;
    saoPass.params.saoBlurDepthCutoff = 0.0001;

    const fxaaPass = new FXAAPass();

    const outputPass = new OutputPass();

    // Bloom
    bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 0.15, 0, 1.0);
    bloomPass.strength = 0.15;
    bloomPass.radius = 0.0;
    bloomPass.threshold = 1.0;

    composer = new EffectComposer(renderer);
    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composer.addPass(ssaoPass);
    composer.addPass(saoPass);
    composer.addPass(outputPass);
    composer.addPass(fxaaPass);

    // --- GUI ---
    const gui = new GUI();

    const ssaoFolder = gui.addFolder('SSAO');
    ssaoFolder.add( ssaoPass, 'output', {
        'Default': SSAOPass.OUTPUT.Default,
        'SSAO Only': SSAOPass.OUTPUT.SSAO,
        'SSAO Only + Blur': SSAOPass.OUTPUT.Blur,
        'Depth': SSAOPass.OUTPUT.Depth,
        'Normal': SSAOPass.OUTPUT.Normal
        } ).onChange( function ( value ) {
            ssaoPass.output = value;
        } );
    ssaoFolder.add( ssaoPass, 'kernelRadius' ).min( 0 ).max( 32 );
    ssaoFolder.add( ssaoPass, 'minDistance' ).min( 0.0001 ).max( 0.02 );
    ssaoFolder.add( ssaoPass, 'maxDistance' ).min( 0.01 ).max( 0.3 );
    ssaoFolder.add( ssaoPass, 'enabled' );
    ssaoFolder.close();

    const saoFolder = gui.addFolder('SAO');
    saoFolder.add( saoPass.params, 'output', {
        'Default': SAOPass.OUTPUT.Default,
        'SAO Only': SAOPass.OUTPUT.SAO,
        'Normal': SAOPass.OUTPUT.Normal
    } ).onChange( function ( value ) {
        saoPass.params.output = value;
    } );
    saoFolder.add( saoPass.params, 'saoBias', - 1, 1 );
    saoFolder.add( saoPass.params, 'saoIntensity', 0, 1 );
    saoFolder.add( saoPass.params, 'saoScale', 0, 30 );
    saoFolder.add( saoPass.params, 'saoKernelRadius', 1, 100 );
    saoFolder.add( saoPass.params, 'saoMinResolution', 0, 1 );
    saoFolder.add( saoPass.params, 'saoBlur' );
    saoFolder.add( saoPass.params, 'saoBlurRadius', 0, 200 );
    saoFolder.add( saoPass.params, 'saoBlurStdDev', 0.5, 150 );
    saoFolder.add( saoPass.params, 'saoBlurDepthCutoff', 0.0, 0.1 );
    saoFolder.add( saoPass, 'enabled' );
    saoFolder.close();

    const bloomFolder = gui.addFolder( 'Bloom' );
    bloomFolder.add( bloomPass, 'threshold', 0.0, 50.0 );
    bloomFolder.add( bloomPass, 'strength', 0.0, 3.0 );
    bloomFolder.add( bloomPass, 'radius', 0.0, 1.0 ).step( 0.01 );
    bloomFolder.close();

    const toneMappingFolder = gui.addFolder( 'Tone mapping' );
    toneMappingFolder.add( params, 'exposure', 0.1, 2 ).onChange( function ( value ) {
        renderer.toneMappingExposure = Math.pow( value, 4.0 );
    } );
    toneMappingFolder.close();

    const lightFolder = gui.addFolder('Flashlight');
    lightFolder.add( params, 'flashlightActive' ).onChange(function(){flashlight.visible = params.flashlightActive});
    lightFolder.add( params, 'flashlightHelperActive' ).onChange(function(){flashlightHelper.visible = params.flashlightHelperActive});
    lightFolder.open();

    const sceneFolder = gui.addFolder('Scene');
    sceneFolder.add(params, 'modelName', ["Garage", "Basement"]).onChange( function ( value ) {
        if (!gltfIsLoading){
            console.log(value);
            if (value == "Garage"){
                loadScene('./garage/garage.gltf');
            } else if(value == "Basement"){
                loadScene('./basement/basement.gltf');
            }
        }
    } );
    sceneFolder.add(params, 'useAreas').onChange( function (){
        useAreas = params.useAreas;
    });

    window.addEventListener('resize', onWindowResize);
}

function initCloseBtn() {
    let closeEl = document.querySelector(".close");
    if (closeEl) {
        closeEl.addEventListener('click', function() {
            window.close();
        });
    };
    return closeEl;
}

function onDocumentMouseDown(event) {
    if (event.target == closeEl) return;
}

function onWindowResize(){
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

function render() {
    const delta = clock.getDelta();

    let newCameraPos = getNewCameraPos(delta);
    if (!useAreas || (useAreas && cameraInArea(newCameraPos))){
        camera.position.set(newCameraPos.x, newCameraPos.y, newCameraPos.z);
    }
    
    flashlightHelper.update(delta);

    stats.update();

    composer.render(delta);

    requestAnimationFrame( render );
    // renderer.render( scene, camera );
}

