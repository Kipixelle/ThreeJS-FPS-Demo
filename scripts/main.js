import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import Stats from 'three/addons/libs/stats.module.js';

import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { SAOPass } from 'three/addons/postprocessing/SAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
// import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

let camera, scene, renderer, composer, stats, bloomPass;
let clock = new THREE.Clock();

let flashlight, flashlightHelper;

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let moveUp = false;
let moveDown = false;

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

let pitch = 0;
let yaw = 0;
const sensitivity = 0.002;
const speed = 6.0;

let zones = [];
let zonesHelper = [];
const zoneInHelperMat = new THREE.LineBasicMaterial({
    color: 0x32a852
});
const zoneOutHelperMat = new THREE.LineBasicMaterial({
    color: 0xa33e33
});

init();
render();

// --- Camera FPS functions ---
function initMouseAndKeyboardForFPSCamera(container){
    // Mouse lock
    container.addEventListener('mousedown', () => {
        document.body.requestPointerLock();
    });

    // Mouse look
    document.body.addEventListener('mousemove', (event) => {
        if (document.pointerLockElement === document.body){
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
    let newCameraPos = camera.position.clone();
    // Update camera
    velocity.set(0, 0, 0);
    // Update camera orientation
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
    let boundingZones = [
        [new THREE.Vector2(-3.5, -3), new THREE.Vector2(3, 4)],
        [new THREE.Vector2(-4, 4), new THREE.Vector2(-2, 7)],
    ]

    for (let i = 0; i < boundingZones.length; i++){
        const bz = boundingZones[i];

        // Add box2
        const min = bz[0];
        const max = bz[1];
        let box2 = new THREE.Box2(min, max);
        zones.push(box2);

        // Create helpers
        const points = [];
        points.push( new THREE.Vector3( min.x, 0.01, min.y ) );
        points.push( new THREE.Vector3( min.x, 0.01, max.y ) );
        points.push( new THREE.Vector3( max.x, 0.01, max.y ) );
        points.push( new THREE.Vector3( max.x, 0.01, min.y ) );
        points.push( new THREE.Vector3( min.x, 0.01, min.y ) );

        const geometry = new THREE.BufferGeometry().setFromPoints( points );

        const line = new THREE.Line( geometry, zoneOutHelperMat );
        scene.add( line );
        zonesHelper.push(line);

        console.log("zone created")
    }
}

function cameraInZone(newCameraPos){
    let updateCamera = false;
    for (let i = 0; i < zones.length; i++){
        const zoneBox2 = zones[i];
        const zoneLine = zonesHelper[i];
        if (zoneBox2.containsPoint(new THREE.Vector2(newCameraPos.x, newCameraPos.z))){
            zoneLine.material = zoneInHelperMat;
            updateCamera = true;
        } else{
            zoneLine.material = zoneOutHelperMat;
        }
    }
    return updateCamera;
}

// --- Light functions ---
function createSpotlight(position, target){
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

    const lightHelper = new THREE.SpotLightHelper( spotLight );
    // scene.add( lightHelper );
}

function createFlashlight(){
    flashlight = new THREE.SpotLight( 0xffffff, 50 );
    flashlight.castShadow = true;
    flashlight.shadow.mapSize.width = 1024;
    flashlight.shadow.mapSize.height = 1024;
    flashlight.shadow.camera.near = 0.1;
    flashlight.shadow.camera.far = 20;
    flashlight.distance = 40;
    flashlight.decay = 1.2;
    flashlight.angle = Math.PI/8;
    flashlight.penumbra = 0.3;

    flashlight.bias = 0.0001;

    camera.add( flashlight );
    flashlight.position.set( 0, 0, 1);
    scene.add( camera );
    flashlight.target = camera;
    flashlight.target.position.add(new THREE.Vector3(0, 0, 1));

    flashlightHelper = new THREE.SpotLightHelper( flashlight );
    scene.add( flashlightHelper );
}


function init(){
    const container = document.getElementById( 'container' );

    const params = {
        flashlightActive : true,
        flashlightHelperActive: true,
        threshold: 1.0,
        strength: 0.15,
        radius: 0,
        exposure: 1.0
    }

    // --- Renderer ---
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.precision = "highp";
    renderer.physicallyCorrectLights = true;     // PBR enabled
    renderer.outputEncoding = THREE.sRGBEncoding; // PBR RGB workflow

    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild( renderer.domElement );

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;          // Global contrast



    // --- Camera ---
    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    camera.position.set(1, 1, 1);

    initMouseAndKeyboardForFPSCamera(container);

    // --- Scene ---
    scene = new THREE.Scene();

    // Load HDR environment
    const rgbeLoader = new HDRLoader();
    rgbeLoader.setPath('./probes/');
    rgbeLoader.load('garage_blender.hdr', function (texture, textureData) {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        // Apply it both as environment and background
        scene.environment = texture;
        scene.background = new THREE.Color(0x0000);
    });

    console.log('HDR loaded!');

    // --- Light ---
    const posA = new THREE.Vector3(1, 4.3, -1.8)
    const targetA = new THREE.Vector3(-1, 0, -1.8)
    // createSpotlight(posA, targetA);
    // const posB = new THREE.Vector3(1, 4.3, 4)
    // const targetB = new THREE.Vector3(-1, 0, 5)
    // createSpotlight(posB, targetB);

    createFlashlight()

    const pointLight1 = new THREE.PointLight( 0xffffff, 0.1, 8, 0 );
    pointLight1.position.set( 0, 0.1, 2 );
    scene.add( pointLight1 );

    // --- Camera zone ---
    createCameraPath()

    // --- Post Process ---
    const renderPass = new RenderPass(scene, camera);

    // SSAO
    const ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
    ssaoPass.kernelRadius = 5;      // Taille du rayon d'occlusion
    ssaoPass.minDistance = 0.0001;   // Distance minimale de calcul
    ssaoPass.maxDistance = 0.1;     // Distance maximale

    const saoPass = new SAOPass( scene, camera );
    saoPass.params.saoBias = -1;
    saoPass.params.saoIntensity = 0.01;
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
    bloomPass.strength = params.strength;
    bloomPass.radius = params.radius;
    bloomPass.threshold = params.threshold;

    composer = new EffectComposer(renderer);
    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composer.addPass(ssaoPass);
    composer.addPass(saoPass);
    composer.addPass(outputPass);
    fxaaPass.enabled = true;
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
    saoFolder.add( saoPass.params, 'saoScale', 0, 10 );
    saoFolder.add( saoPass.params, 'saoKernelRadius', 1, 100 );
    saoFolder.add( saoPass.params, 'saoMinResolution', 0, 1 );
    saoFolder.add( saoPass.params, 'saoBlur' );
    saoFolder.add( saoPass.params, 'saoBlurRadius', 0, 200 );
    saoFolder.add( saoPass.params, 'saoBlurStdDev', 0.5, 150 );
    saoFolder.add( saoPass.params, 'saoBlurDepthCutoff', 0.0, 0.1 );
    saoFolder.add( saoPass, 'enabled' );


    const lightFolder = gui.addFolder('Flashlight');
    lightFolder.add( params, 'flashlightActive' ).onChange(function(){flashlight.visible = params.flashlightActive});
    lightFolder.add( params, 'flashlightHelperActive' ).onChange(function(){flashlightHelper.visible = params.flashlightHelperActive});
    lightFolder.open();

    const bloomFolder = gui.addFolder( 'bloom' );
    bloomFolder.add( params, 'threshold', 0.0, 50.0 ).onChange( function ( value ) {
        bloomPass.threshold = Number( value );
    } );
    bloomFolder.add( params, 'strength', 0.0, 3.0 ).onChange( function ( value ) {
        bloomPass.strength = Number( value );
    } );
    gui.add( params, 'radius', 0.0, 1.0 ).step( 0.01 ).onChange( function ( value ) {
        bloomPass.radius = Number( value );
    } );

    const toneMappingFolder = gui.addFolder( 'tone mapping' );
    toneMappingFolder.add( params, 'exposure', 0.1, 2 ).onChange( function ( value ) {
        renderer.toneMappingExposure = Math.pow( value, 4.0 );
    } );


    // --- GLTF ---
    const loader = new GLTFLoader();

    loader.load( './garage/garage.gltf', function ( gltf ) {
        const mesh = gltf.scene;
        mesh.traverse ( function ( child )
        {
            if ( child.isMesh )
            {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        scene.add( mesh );

    }, undefined, function ( error ) {
        console.error( error );
    });

    // Show fps
    stats = new Stats();
    container.appendChild( stats.domElement );

    window.addEventListener('resize', onWindowResize);
}

function onWindowResize(){
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

function render() {
    const delta = clock.getDelta();

    let newCameraPos = getNewCameraPos(delta)
    if (cameraInZone(newCameraPos)){
        camera.position.set(newCameraPos.x, newCameraPos.y, newCameraPos.z);
    }

    flashlightHelper.update(delta)

    stats.update();

    composer.render(delta);

    requestAnimationFrame( render );
    // renderer.render(scene, camera);
}
  

