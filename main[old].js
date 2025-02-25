// Import Three.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import GUI from 'lil-gui';
import { RectAreaLightHelper } from 'three/examples/jsm/Addons.js';
import Stats from 'three/examples/jsm/libs/stats.module'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import * as CANNON from 'cannon-es';

const stats = Stats()
document.body.appendChild(stats.dom)
// Scene and Camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);
// const helper = new THREE.CameraHelper( camera );
// scene.add( helper );

// lil-gui toolset 
const gui = new GUI();

// Renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = 0.75
document.body.appendChild(renderer.domElement);

// Fog
scene.fog = new THREE.Fog(0x000000, 10, 30); // Black fog for night effect
renderer.setClearColor(scene.fog.color);

// 3d loader
const manager = new THREE.LoadingManager();
manager.onLoad = init;
const progressbarElem = document.querySelector('#progressbar');
manager.onProgress = (url, itemsLoaded, itemsTotal) => {
  progressbarElem.style.width = `${itemsLoaded / itemsTotal * 100 | 0}%`;
};
const controlsObj = {
    toneMappingExposure: 0.75,
    backgroundIntensity: 1,
    toneMapping: THREE.ReinhardToneMapping,
    pixelRatio: 1
}
const models = {
    nissanModel: { 
        url: 'models/240sx/nissan_240sx.glb', 
        rotation: [0, 0, 0], 
        position: [-1, 0.65, 0],
        get leftHeadlightPosition() {return({x: this.position[0]-0.61,y: this.position[1]-0.05,z: this.position[2]-2.498})},
        get rightHeadlightPosition(){return({x: this.position[0]+0.61,y: this.position[1]-0.05,z: this.position[2]-2.498})},
        get leftTaillightPosition() {return({x: this.position[0]-0.62,y: this.position[1]+0.06,z: this.position[2]+2.42})},
        get rightTaillightPosition(){return({x: this.position[0]+0.62,y: this.position[1]+0.06,z: this.position[2]+2.42})},
        get interiorLightPosition() {return({x: this.position[0]-0.42,y: this.position[1]+0.15,z: this.position[2]-0.5})},
        lights: []
    },
    // SupraModel: { 
    //     url: 'models/supra/toyota_supra_a80_1993.glb', 
    //     rotation: [0, 3.14, 0], 
    //     position: [2, -0.05, -0.2],
    //     scale: [0.37, 0.37, 0.37],
    //     get leftHeadlightPosition() {return({x: this.position[0]-0.61,y: this.position[1]+0.7,z: this.position[2]-2.38})},
    //     get rightHeadlightPosition(){return({x: this.position[0]+0.61,y: this.position[1]+0.7,z: this.position[2]-2.38})},
    //     get leftTaillightPosition() {return({x: this.position[0]-0.54,y: this.position[1]+1,z: this.position[2]+2.72})},
    //     get rightTaillightPosition(){return({x: this.position[0]+0.54,y: this.position[1]+1,z: this.position[2]+2.72})},
    //     get interiorLightPosition() {return({x: this.position[0]-0.42,y: this.position[1]+0.15,z: this.position[2]-0.5})},
    //     lights: []
    // },
    // subaruModel: { 
    //     url: 'models/wrx/2010_subaru_rally_car.glb', 
    //     rotation: [0, 3.55, 0], 
    //     position: [0, 0.65, 0],
    //     scale: [2.2, 2.2, 2.2],
    //     get leftHeadlightPosition() {return({x: this.position[0]-0.61,y: this.position[1]-0.05,z: this.position[2]-2.498})},
    //     get rightHeadlightPosition(){return({x: this.position[0]+0.61,y: this.position[1]-0.05,z: this.position[2]-2.498})},
    //     get leftTaillightPosition() {return({x: this.position[0]-0.62,y: this.position[1]+0.06,z: this.position[2]+2.5})},
    //     get rightTaillightPosition(){return({x: this.position[0]+0.62,y: this.position[1]+0.06,z: this.position[2]+2.5})},
    //     get interiorLightPosition() {return({x: this.position[0]-0.42,y: this.position[1]+0.15,z: this.position[2]-0.5})},
    //     lights: []
    // },
    // mercedesModel: { 
    //     url:'models/c63/mercedes_benz_c63_amg.glb', 
    //     rotation: [0, 1.55, 0], 
    //     position: [2, 0.8, 0], 
    //     scale: [2.2, 2.2, 2.2],
    //     get leftHeadlightPosition() {return({x: this.position[0]-0.61,y: this.position[1]+0.7,z: this.position[2]-2.38})},
    //     get rightHeadlightPosition(){return({x: this.position[0]+0.61,y: this.position[1]+0.7,z: this.position[2]-2.38})},
    //     get leftTaillightPosition() {return({x: this.position[0]-0.54,y: this.position[1]+1,z: this.position[2]+2.72})},
    //     get rightTaillightPosition(){return({x: this.position[0]+0.54,y: this.position[1]+1,z: this.position[2]+2.72})},
    //     get interiorLightPosition() {return({x: this.position[0]-0.42,y: this.position[1]+0.15,z: this.position[2]-0.5})},
    //     lights: []
    // },
};
{
    // HDR background loader
    const rgbeLoader = new RGBELoader(manager).load('NightSky[city2].hdr', (environmentMap) =>{
        environmentMap.mapping = THREE.EquirectangularReflectionMapping;
        scene.background = environmentMap;
        scene.environment = environmentMap;
        scene.toneMappingExposure = controlsObj.toneMappingExposure;
        scene.toneMapping = controlsObj.toneMapping;
    });

    const gltfLoader = new GLTFLoader(manager);
    for (const model of Object.values(models)) {
        gltfLoader.load(model.url, (gltf) => {
            model.gltf = gltf;
        }, undefined, function  ( error ) {
			console.error( error );
		});
    }
}
function init() {
    Object.values(models).forEach((model, ndx) => {
        console.log(model);
        // Create RigidBody objects for the chassis and body parts
        // const chassisGeometry = new THREE.BufferGeometry();
        // const bodyGeometry = new THREE.BufferGeometry();

        const clonedScene = SkeletonUtils.clone(model.gltf.scene);
        const root = new THREE.Object3D();
        root.add(clonedScene);

        // Set rotation and position of each model
        root.rotation.set(model.rotation[0], model.rotation[1], model.rotation[2]);
        root.position.set(model.position[0], model.position[1], model.position[2]);
        // Set model scale (optional)
        if ('scale' in model) {
            root.scale.set(model.scale[0], model.scale[1], model.scale[2]);
        }

        scene.add(root);
        // Set mesh shadows
        scene.traverse((object) => {
            if (object instanceof THREE.Mesh) {
                object.castShadow = true;
                object.receiveShadow = true;
                object.material.envMapIntensity = 10;
                if(object.material.name.includes('light')){
                    if(object.name.includes('head')){
                        object.material.emissive = new THREE.Color('0xffffff');
                        object.material.emissiveIntensity = 2;
                        object.material.transparent = true;
                        object.material.opacity = 0.6;
                        object.material.depthWrite = false;
                    }
                    if(object.name.includes('tail')){
                        object.material.emissive = new THREE.Color('#ff0000');
                        object.material.emissiveIntensity = 2;
                        object.material.transparent = true;
                        object.material.opacity = 0.6;
                        object.material.depthWrite = false;
                    }
                }
                if(object.name.includes('wheel')) {
                    console.log(object.name)
                }
            }
        })
        // Create and position light sources for each headlight
        createLightSources(model, function(){
            // Add controls for each light source
            const gui = new GUI();
            // addLightControls(model, gui);
            addRendererControls(renderer, gui);
        });
        // hide the loading bar
        const loadingElem = document.querySelector('#loading');
        loadingElem.style.display = 'none';
      });
    // Function to create and position light sources for each headlight
    function createLightSources(model, callback) {
        const {leftHeadlightPosition,rightHeadlightPosition,leftTaillightPosition,rightTaillightPosition,interiorLightPosition, lights} = model;
        const lightGroup = new THREE.Group();

        // Add point lights
        // lights.push(leftLight,rightLight);
        // lightGroup.add(leftLight,rightLight);
        // const leftLightHelper = new THREE.PointLightHelper( leftLight );
        // const rightLightHelper = new THREE.PointLightHelper( rightLight );
        // leftLightGroup.add(leftLightHelper);
        // rightLightGroup.add(rightLightHelper);

        // Tailights-----------------------------------------------------------------
        const leftTaillight = new THREE.PointLight(0xFF0000, 0.1, 0.5, 2);
        const rightTaillight = new THREE.PointLight(0xFF0000, 0.1, 0.5, 2);
        leftTaillight.position.set(leftTaillightPosition.x, leftTaillightPosition.y, leftTaillightPosition.z);
        rightTaillight.position.set(rightTaillightPosition.x, rightTaillightPosition.y, rightTaillightPosition.z);
        // Add point lights to their respective groups
        lights.push(leftTaillight, rightTaillight);
        lightGroup.add (leftTaillight, rightTaillight);
        // const leftTaillightHelper = new THREE.PointLightHelper( leftTaillight );
        // const rightTaillightHelper = new THREE.PointLightHelper( rightTaillight );
        // lightGroup.add(leftTaillightHelper, rightTaillightHelper);

        // Interior Light-------------------------------------------------------------
        const interiorLight = new THREE.PointLight (0x17BA79, 0.2, 0.4, 1.5);
        interiorLight.position.set(interiorLightPosition.x, interiorLightPosition.y, interiorLightPosition.z);
        lights.push(interiorLight);
        lightGroup.add (interiorLight);
        // const interiorLightHelper = new THREE.PointLightHelper( interiorLight );
        // interiorLightGroup.add(interiorLightHelper);
        
        // Spotlight for each headlight
        const leftSpotLight = new THREE.SpotLight(0xffffff, 1, 10, Math.PI / 4);
        const rightSpotLight = new THREE.SpotLight(0xffffff, 1, 10, Math.PI / 4);
        leftSpotLight.position.set(leftHeadlightPosition.x, leftHeadlightPosition.y-0.05, leftHeadlightPosition.z+0.15);
        rightSpotLight.position.set(rightHeadlightPosition.x, rightHeadlightPosition.y-0.05, rightHeadlightPosition.z+0.15);
        // Point the spotlights forward
        leftSpotLight.target.position.set(1, 0.65, -50); // Note: Changed to point forward
        rightSpotLight.target.position.set(-1, 0.65, -50); // Note: Changed to point forward
        // Add spot lights to their respective groups
        lights.push(leftSpotLight, rightSpotLight);
        lightGroup.add(leftSpotLight,rightSpotLight);
        
        // Spotlight helpers
        const leftSpotLightHelper = new THREE.SpotLightHelper( leftSpotLight );
        const rightSpotLightHelper = new THREE.SpotLightHelper( rightSpotLight );
        // leftLightGroup.add(leftSpotLightHelper);
        // rightLightGroup.add(rightSpotLightHelper);
        scene.add(lightGroup);
        callback();
    }
    function addLightControls(model, gui) {
        // Create folders for each type of light
        const headlightsFolder = gui.addFolder("Headlights");
        const taillightsFolder = gui.addFolder("Taillights");
        const interiorLightFolder = gui.addFolder("Interior Light");
      
        // Add sliders for intensity and range to the GUI
        headlightsFolder.add(model.lights[5], 'intensity').name('Left Headlight Intensity');
        headlightsFolder.addColor(model.lights[5], 'color').name('Left Headlight Color');

        headlightsFolder.add(model.lights[6], 'intensity').name('Right Headlight Intensity');
        headlightsFolder.addColor(model.lights[6], 'color').name('Right Headlight Color');
      
        taillightsFolder.add(model.lights[2], 'intensity').name('Left Taillight Intensity');
        taillightsFolder.add(model.lights[2], 'distance').name('Left Taillight Range');
        taillightsFolder.add(model.lights[2].position, 'x', -5, 5).name('Left X');
        taillightsFolder.add(model.lights[2].position, 'y', -5, 5).name('Left Y');
        taillightsFolder.add(model.lights[2].position, 'z', -5, 5).name('Left Z');

        taillightsFolder.add(model.lights[3], 'intensity').name('Right Taillight Intensity');
        taillightsFolder.add(model.lights[3], 'distance').name('Right Taillight Range');
      
        interiorLightFolder.add(model.lights[4], 'intensity').name('Interior Light Intensity');
        interiorLightFolder.addColor(model.lights[4], 'color').name('Interior Light Color');
    }
      function addRendererControls(renderer, gui){
        const ToneFolder = gui.addFolder("Tone Mapping");
        const BackgroundFolder = gui.addFolder( 'Background' );
        ToneFolder.add(renderer,'toneMapping',{
          'No Tone Mapping': THREE.NoToneMapping,
          'Neutral Tone Mapping': THREE.NeutralToneMapping, 
          'Linear Tone Mapping': THREE.LinearToneMapping, 
          'Reinhard Tone Mapping': THREE.ReinhardToneMapping,
        }).name('Tone Mapping');
        ToneFolder.add(renderer,'toneMappingExposure',0,2).step(.05);
        BackgroundFolder.add(scene, 'backgroundIntensity', 0, 2).step(.05);          
    }
}

// Orbit Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Plane with Asphalt Texture
const planeGeometry = new THREE.PlaneGeometry(20, 20);
const asphaltTexture = new THREE.TextureLoader().load('textures/asphalt.jpg');
asphaltTexture.wrapS = asphaltTexture.wrapT = THREE.RepeatWrapping;
asphaltTexture.repeat.set(16, 16);
const planeMaterial = new THREE.MeshStandardMaterial({ map: asphaltTexture });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2; // Rotate to lie flat
scene.add(plane);

// Ambient Light (Low Intensity for Night Effect)
const ambientLight = new THREE.AmbientLight(0x404040, 0.4); // Dim ambient light
scene.add(ambientLight);

// Directional Light (Moonlight-like Effect)
const directionalLight = new THREE.DirectionalLight( 0x404040, 0.3 );
directionalLight.position.set( 0, 1, 0 ); //default; light shining from top
directionalLight.castShadow = true; // default false
scene.add(directionalLight);

// Spotlight (Yellowish Streetlight Effect)
const spotLight = new THREE.SpotLight(0xFFEA7D, 15); // Yellow light
spotLight.position.set(0, 5, 0); // Above the cube
spotLight.target = plane; // Point at the cube
spotLight.angle = Math.PI / 3.5; // Narrow beam
spotLight.penumbra = 1;
spotLight.castShadow = true; // Enable shadows
scene.add(spotLight);
// spotlight helper
// const spotLightHelper = new THREE.SpotLightHelper( spotLight );
// scene.add( spotLightHelper );

// Shadow Settings
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
plane.receiveShadow = true;
spotLight.castShadow = true;

// Create the composer for post-processing
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    2, // strength
    0.4, // radius
    0.85 // threshold
);
composer.addPass(bloomPass);

// --------------------------------------------- Rigid body with physics ----------------------------------------------

const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0), // m/s²
  })
  



// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    // Run the simulation independently of framerate every 1 / 60 ms
    world.fixedStep();

    controls.update();
    // renderer.render(scene, camera);
    composer.render();
    stats.update()
    
}
animate();

// Handle Window Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
