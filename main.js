import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import CannonDebugger from 'cannon-es-debugger';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import GUI from 'lil-gui';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import Stats from 'three/examples/jsm/libs/stats.module';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export class VehicleScene {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(1);
        this.renderer.toneMapping = THREE.ReinhardToneMapping;
        this.renderer.toneMappingExposure = 0.75;
        document.body.appendChild(this.renderer.domElement);

        this.composer = new EffectComposer(this.renderer);
        this.renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(this.renderPass);

        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.5, 0.4, 0.85
        );
        this.composer.addPass(this.bloomPass);

        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(0, 10, 10);
        this.scene.add(directionalLight);

        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
        this.camera.position.set(0, 20, 20);
        this.orbitControls.update();

        this.thirdPersonCamera = this.camera.clone();
        this.thirdPersonControls = null;
        this.cameraMode = 'orbit';

        this.showCameraDebug = false;
        const markerGeometry = new THREE.SphereGeometry(0.2, 16, 16);
        this.orbitCameraMarker = new THREE.Mesh(markerGeometry, new THREE.MeshBasicMaterial({ color: 0xff0000 }));
        this.thirdCameraMarker = new THREE.Mesh(markerGeometry, new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
        this.scene.add(this.orbitCameraMarker);
        this.scene.add(this.thirdCameraMarker);

        this.world = new CANNON.World();
        this.world.gravity.set(0, -30, 0);
        this.world.broadphase = new CANNON.SAPBroadphase(this.world);
        this.world.defaultContactMaterial.friction = 1;

        this.cannonDebugger = new CannonDebugger(this.scene, this.world, { color: 0x00ff00 });
        this.showDebug = true;

        this.modelWheelGroups = [[], [], [], []];

        // Audio setup
        this.listener = new THREE.AudioListener();
        this.camera.add(this.listener);
        this.engineSound = null;
        this.audioLoaded = false;
        this.basePitch = 1.0;
        this.maxPitch = 3.2;
        this.reversePitch = 1.5;
        this.baseGain = 0.1;
        this.maxGain = 0.3;
        this.reverseGain = 0.2;
        this.currentPitch = this.basePitch;
        this.targetPitch = this.basePitch;
        this.pitchLerpFactor = 0.05;
        this.maxSpeed = 20;

        // Handbrake state
        this.handbrakeActive = false;

        this.setupVehicle();
        window.addEventListener('resize', this.onWindowResize.bind(this));
        this.animate();
        this.setupGUI();
    }

    loadEngineSound(url) {
        const audioLoader = new THREE.AudioLoader();
        audioLoader.load(url, (buffer) => {
            this.engineSound = new THREE.PositionalAudio(this.listener);
            this.engineSound.setBuffer(buffer);
            this.engineSound.setLoop(true);
            this.engineSound.setRefDistance(10);
            this.engineSound.setRolloffFactor(1);
            this.engineSound.setVolume(this.baseGain);
            this.engineSound.setPlaybackRate(this.basePitch);
            this.audioLoaded = true;
            if (this.vehicleModelWrapper) {
                this.vehicleModelWrapper.add(this.engineSound);
                this.engineSound.position.set(0, 0, 0);
                this.engineSound.updateMatrixWorld(true);
            }
            console.log('Engine sound loaded');
        }, undefined, (error) => {
            console.error('Error loading engine sound:', error);
        });
    }

    startAudio() {
        if (this.audioLoaded && !this.engineSound.isPlaying) {
            this.engineSound.play();
            console.log('Engine sound started');
        }
    }

    setupVehicle() {
        const chassisShape = new CANNON.Box(new CANNON.Vec3(5, 0.5, 2));
        this.chassisBody = new CANNON.Body({ 
            mass: 11,
            angularDamping: 0.4,
            linearDamping: 0.2
        });
        const centerOfMassAdjust = new CANNON.Vec3(0, -1, 0);
        this.chassisBody.addShape(chassisShape, centerOfMassAdjust);

        const chassisGeometry = new THREE.BoxGeometry(10, 1, 4);
        const chassisMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
        this.chassisMesh = new THREE.Mesh(chassisGeometry, chassisMaterial);
        this.scene.add(this.chassisMesh);

        this.vehicle = new CANNON.RigidVehicle({
            chassisBody: this.chassisBody,
        });

        const mass = 1;
        const axisWidth = 7.5;
        const wheelShape = new CANNON.Sphere(0.8);
        const wheelMaterial = new CANNON.Material('wheel');
        const down = new CANNON.Vec3(0, -1, 0);

        this.wheelMeshes = [];
        const wheelPositions = [
            new CANNON.Vec3(-3.2, -0.2, axisWidth / 4),
            new CANNON.Vec3(-3.2, -0.2, -axisWidth / 4),
            new CANNON.Vec3(2.8, -0.2, axisWidth / 4),
            new CANNON.Vec3(2.8, -0.2, -axisWidth / 4)
        ];
        const wheelAxes = [
            new CANNON.Vec3(0, 0, 1),
            new CANNON.Vec3(0, 0, -1),
            new CANNON.Vec3(0, 0, 1),
            new CANNON.Vec3(0, 0, -1)
        ];

        this.suspensionOffsets = [0, 0, 0, 0];

        for (let i = 0; i < 4; i++) {
            const wheelBody = new CANNON.Body({ 
                mass, 
                material: wheelMaterial,
                angularDamping: 0.4,
                linearDamping: 0.6
            });
            wheelBody.addShape(wheelShape);
            this.vehicle.addWheel({
                body: wheelBody,
                position: wheelPositions[i].vadd(centerOfMassAdjust),
                axis: wheelAxes[i],
                direction: down,
                suspensionStiffness: 20,
                suspensionRestLength: 0.8,
                suspensionDamping: 4,
                rollInfluence: i < 2 ? 0.2 : 0.4
            });
            const wheelMesh = new THREE.Group();
            this.scene.add(wheelMesh);
            this.wheelMeshes.push(wheelMesh);
        }

        this.vehicle.addToWorld(this.world);

        const groundShape = new CANNON.Plane();
        const groundMaterial = new CANNON.Material('ground');
        this.groundBody = new CANNON.Body({ mass: 0, material: groundMaterial });
        this.groundBody.addShape(groundShape);
        this.groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.world.addBody(this.groundBody);

        const groundGeometry = new THREE.PlaneGeometry(300, 300);
        const groundMaterialVisual = new THREE.MeshPhongMaterial({ color: 0x888888 });
        this.groundMesh = new THREE.Mesh(groundGeometry, groundMaterialVisual);
        this.groundMesh.rotation.x = -Math.PI / 2;
        this.groundMesh.receiveShadow = true;
        this.scene.add(this.groundMesh);

        const spotLight = new THREE.SpotLight(0xFFEA7D, 100);
        spotLight.position.set(0, 5, 0);
        spotLight.target = this.groundMesh;
        spotLight.angle = Math.PI / 2;
        spotLight.penumbra = 1;
        spotLight.castShadow = true;
        this.scene.add(spotLight);

        const wheel_ground = new CANNON.ContactMaterial(wheelMaterial, groundMaterial, {
            friction: 1,
            restitution: 0.1,
            contactEquationStiffness: 1000,
            frictionEquationStiffness: 125
        });
        this.world.addContactMaterial(wheel_ground);

        this.vehicle.wheelBodies[2].material.friction = 0.2; // Default rear wheel friction
        this.vehicle.wheelBodies[3].material.friction = 0.2;

        this.setupControls();
    }

    loadVehicleModel(glbPath, scale = 1) {
        const loader = new GLTFLoader();
        loader.load(
            glbPath,
            (gltf) => {
                this.scene.remove(this.chassisMesh);
                this.vehicleModel = gltf.scene;
                this.vehicleModel.scale.set(scale, scale, scale);

                this.modelWheelGroups = [[], [], [], []];
                const wheelsToReparent = [];

                this.vehicleModel.traverse((object) => {
                    if (object instanceof THREE.Mesh) {
                        object.castShadow = true;
                        object.receiveShadow = true;
                        object.material.envMapIntensity = 10;
                        
                        if (object.material.name.includes('light')) {
                            if (object.name.includes('head')) {
                                object.material.emissive = new THREE.Color('0xffffff');
                                object.material.emissiveIntensity = 2;
                                object.material.transparent = true;
                                object.material.opacity = 0.6;
                                object.material.depthWrite = false;
                            }
                            if (object.name.includes('tail')) {
                                object.material.emissive = new THREE.Color('#ff0000');
                                object.material.emissiveIntensity = 2;
                                object.material.transparent = true;
                                object.material.opacity = 0.6;
                                object.material.depthWrite = false;
                            }
                        }
                        
                        const nameLower = object.name.toLowerCase();
                        if (nameLower.includes('wheel')) {
                            let wheelIndex;
                            if (nameLower.includes('wheel1') || nameLower === 'wheel') wheelIndex = 0;
                            else if (nameLower.includes('wheel2')) wheelIndex = 1;
                            else if (nameLower.includes('wheel3')) wheelIndex = 2;
                            else if (nameLower.includes('wheel4')) wheelIndex = 3;
                            if (wheelIndex !== undefined) {
                                wheelsToReparent.push({ object, wheelIndex });
                            }
                        }
                    }
                });

                wheelsToReparent.forEach(({ object, wheelIndex }) => {
                    if (object.parent) object.parent.remove(object);
                    object.scale.set(2, 2, 2);
                    
                    if (wheelIndex === 0) object.position.set(-0.95, -3.02, -1.7);
                    else if (wheelIndex === 1) object.position.set(-0.98, -3.02, 1.7);
                    else if (wheelIndex === 2) object.position.set(0.575, 2.69, -1.7);
                    else if (wheelIndex === 3) object.position.set(0.575, 2.69, 1.7);

                    if (wheelIndex === 0) object.rotation.set(THREE.MathUtils.degToRad(1), THREE.MathUtils.degToRad(-79), THREE.MathUtils.degToRad(1));
                    else if (wheelIndex === 1) object.rotation.set(0, THREE.MathUtils.degToRad(-102), 0);
                    else if (wheelIndex === 2) object.rotation.set(THREE.MathUtils.degToRad(-5), THREE.MathUtils.degToRad(90), THREE.MathUtils.degToRad(5));
                    else if (wheelIndex === 3) object.rotation.set(THREE.MathUtils.degToRad(-5), THREE.MathUtils.degToRad(90), THREE.MathUtils.degToRad(5));

                    this.wheelMeshes[wheelIndex].add(object);
                    this.modelWheelGroups[wheelIndex].push(object);
                    console.log(`Attached ${object.name} to physics wheel ${wheelIndex}`);
                });

                this.vehicleModelWrapper = new THREE.Group();
                this.vehicleModelWrapper.add(this.vehicleModel);
                this.vehicleModel.rotation.y = Math.PI / 2;
                this.vehicleModel.position.y = -0.5;
                this.scene.add(this.vehicleModelWrapper);

                this.vehicleModelWrapper.position.copy(this.chassisBody.position);
                this.vehicleModelWrapper.quaternion.copy(this.chassisBody.quaternion);

                this.vehicleModel.add(this.thirdPersonCamera);
                this.thirdPersonCamera.position.set(0, 1, 4);
                this.thirdPersonCamera.lookAt(1, 2, 0);

                this.thirdPersonControls = new OrbitControls(this.thirdPersonCamera, this.renderer.domElement);
                this.thirdPersonControls.target.set(0, 0, 0);
                this.thirdPersonControls.enabled = false;

                if (this.engineSound) {
                    this.vehicleModelWrapper.add(this.engineSound);
                    this.engineSound.position.set(0, 0, 0);
                    this.engineSound.updateMatrixWorld(true);
                }
                this.loadEngineSound('models/240sx/240sxSound.mp3');

                console.log('Vehicle model loaded successfully with glTF wheels parented to physics wheels');
            },
            (progress) => console.log(`Loading model: ${(progress.loaded / progress.total * 100).toFixed(2)}%`),
            (error) => console.error('Error loading GLB model:', error)
        );
    }

    setupControls() {
        const maxSteerVal = Math.PI / 4;
        const maxForce = 130;

        document.addEventListener('keydown', (event) => {
            this.startAudio();

            switch (event.key) {
                case 'w':
                case 'ArrowUp':
                    this.vehicle.setWheelForce(maxForce, 2);
                    this.vehicle.setWheelForce(-maxForce, 3);
                    if (this.audioLoaded && this.engineSound.isPlaying) {
                        this.engineSound.gain.gain.linearRampToValueAtTime(this.maxGain, this.engineSound.context.currentTime + 0.1);
                    }
                    break;
                case 's':
                case 'ArrowDown':
                    this.vehicle.setWheelForce(-maxForce / 2, 2);
                    this.vehicle.setWheelForce(maxForce / 2, 3);
                    if (this.audioLoaded && this.engineSound.isPlaying) {
                        this.targetPitch = this.reversePitch;
                        this.engineSound.gain.gain.linearRampToValueAtTime(this.reverseGain, this.engineSound.context.currentTime + 0.1);
                    }
                    break;
                case 'a':
                case 'ArrowLeft':
                    this.vehicle.setSteeringValue(maxSteerVal, 0);
                    this.vehicle.setSteeringValue(maxSteerVal, 1);
                    break;
                case 'd':
                case 'ArrowRight':
                    this.vehicle.setSteeringValue(-maxSteerVal, 0);
                    this.vehicle.setSteeringValue(-maxSteerVal, 1);
                    break;
                case ' ': // Spacebar for handbrake
                    this.handbrakeActive = true;
                    break;
            }
        });

        document.addEventListener('keyup', (event) => {
            switch (event.key) {
                case 'w':
                case 'ArrowUp':
                case 's':
                case 'ArrowDown':
                    this.vehicle.setWheelForce(0, 2);
                    this.vehicle.setWheelForce(0, 3);
                    if (this.audioLoaded && this.engineSound.isPlaying) {
                        this.engineSound.gain.gain.linearRampToValueAtTime(this.baseGain, this.engineSound.context.currentTime + 0.2);
                    }
                    break;
                case 'a':
                case 'ArrowLeft':
                case 'd':
                case 'ArrowRight':
                    this.vehicle.setSteeringValue(0, 0);
                    this.vehicle.setSteeringValue(0, 1);
                    break;
                case ' ': // Release handbrake
                    this.handbrakeActive = false;
                    break;
            }
        });
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.thirdPersonCamera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.thirdPersonCamera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        this.world.step(1 / 60);

        // Apply handbrake effect with skid behavior
        if (this.handbrakeActive) {
            // Lock rear wheels by setting their force to 0
            this.vehicle.setWheelForce(0, 2);
            this.vehicle.setWheelForce(0, 3);
            // Reduce friction on rear wheels for skidding
            this.vehicle.wheelBodies[2].material.friction = -5; // Low friction for skid
            this.vehicle.wheelBodies[3].material.friction = -5;
        } else {
            // Restore normal friction when handbrake is off
            this.vehicle.wheelBodies[2].material.friction = 0.2; // Default rear wheel friction
            this.vehicle.wheelBodies[3].material.friction = 0.2;
        }

        if (this.chassisBody.angularVelocity.length() > 0.1) {
            this.chassisBody.angularVelocity.x *= 0.98;
            this.chassisBody.angularVelocity.z *= 0.98;
        }

        this.chassisMesh.position.copy(this.chassisBody.position);
        this.chassisMesh.quaternion.copy(this.chassisBody.quaternion);
        
        if (this.vehicleModelWrapper) {
            this.vehicleModelWrapper.position.copy(this.chassisBody.position);
            this.vehicleModelWrapper.quaternion.copy(this.chassisBody.quaternion);
            if (this.engineSound && this.engineSound.isPlaying) {
                this.engineSound.updateMatrixWorld();
            }
        }

        for (let i = 0; i < this.vehicle.wheelBodies.length; i++) {
            this.wheelMeshes[i].position.copy(this.vehicle.wheelBodies[i].position);
            this.wheelMeshes[i].quaternion.copy(this.vehicle.wheelBodies[i].quaternion);
        }

        // Speed-based pitch adjustment
        if (this.audioLoaded && this.engineSound.isPlaying) {
            const speed = this.chassisBody.velocity.length();
            const wheelForce = this.vehicle.wheelBodies[2].force.y;

            if (this.handbrakeActive) {
                // Lower pitch slightly when handbrake is active (optional)
                this.targetPitch = this.basePitch * 0.9;
            } else if (wheelForce > 0) { // Forward motion
                this.targetPitch = THREE.MathUtils.lerp(this.basePitch, this.maxPitch, Math.min(speed / this.maxSpeed, 1));
            } else if (wheelForce < 0) { // Reverse motion
                this.targetPitch = this.reversePitch;
            } else { // No force (coasting or stopped)
                this.targetPitch = THREE.MathUtils.lerp(this.basePitch, this.maxPitch, Math.min(speed / this.maxSpeed, 1));
            }

            // Interpolate current pitch toward target pitch
            this.currentPitch += (this.targetPitch - this.currentPitch) * this.pitchLerpFactor;
            this.engineSound.setPlaybackRate(this.currentPitch);
        }

        if (this.cameraMode === 'third' && this.vehicleModelWrapper) {
            const vehiclePosition = this.vehicleModelWrapper.position;
            this.thirdPersonCamera.lookAt(
                vehiclePosition.x + this.lookAtOffsets.x,
                vehiclePosition.y + this.lookAtOffsets.y,
                vehiclePosition.z + this.lookAtOffsets.z
            );
        }

        if (this.cameraMode === 'orbit') {
            this.orbitControls.update();
        }

        if (this.showCameraDebug) {
            this.orbitCameraMarker.position.copy(this.camera.position);
            this.thirdCameraMarker.position.copy(this.thirdPersonCamera.getWorldPosition(new THREE.Vector3()));
            this.orbitCameraMarker.visible = true;
            this.thirdCameraMarker.visible = true;
        } else {
            this.orbitCameraMarker.visible = false;
            this.thirdCameraMarker.visible = false;
        }

        if (this.showDebug) {
            this.cannonDebugger.update();
        }

        const activeCamera = this.cameraMode === 'third' ? this.thirdPersonCamera : this.camera;
        if (this.listener.parent !== activeCamera) {
            this.listener.parent.remove(this.listener);
            activeCamera.add(this.listener);
        }
        this.renderPass.camera = activeCamera;
        this.composer.render();
    }

    setupGUI() {
        const gui = new GUI();
        gui.add({ toggleCamera: () => this.toggleCamera() }, 'toggleCamera')
           .name('Toggle Camera (Orbit/Third)');
        gui.add({ toggleDebug: () => this.toggleDebug() }, 'toggleDebug')
           .name('Toggle Physics Debug');
        gui.add({ toggleCameraDebug: () => this.toggleCameraDebug() }, 'toggleCameraDebug')
           .name('Toggle Camera Debug');

        const cameraFolder = gui.addFolder('Third-Person Camera');
        const positionFolder = cameraFolder.addFolder('Position');
        const cameraPosParams = { x: 0, y: 1, z: 4 };
        positionFolder.add(cameraPosParams, 'x', -20, 20)
            .name('X Position')
            .onChange((value) => this.thirdPersonCamera.position.x = value);
        positionFolder.add(cameraPosParams, 'y', -20, 20)
            .name('Y Position')
            .onChange((value) => this.thirdPersonCamera.position.y = value);
        positionFolder.add(cameraPosParams, 'z', -20, 20)
            .name('Z Position')
            .onChange((value) => this.thirdPersonCamera.position.z = value);
        positionFolder.open();

        const lookAtFolder = cameraFolder.addFolder('LookAt Offset');
        this.lookAtOffsets = { x: 1, y: 1, z: -4 };
        lookAtFolder.add(this.lookAtOffsets, 'x', -50, 50).name('X Offset');
        lookAtFolder.add(this.lookAtOffsets, 'y', -50, 50).name('Y Offset');
        lookAtFolder.add(this.lookAtOffsets, 'z', -50, 50).name('Z Offset');
        lookAtFolder.open();
        cameraFolder.open();

        const bloomFolder = gui.addFolder('Bloom Settings');
        const bloomParams = { strength: 0.5, radius: 0.4, threshold: 0.85 };
        bloomFolder.add(bloomParams, 'strength', 0, 2)
            .name('Strength')
            .onChange((value) => this.bloomPass.strength = value);
        bloomFolder.add(bloomParams, 'radius', 0, 1)
            .name('Radius')
            .onChange((value) => this.bloomPass.radius = value);
        bloomFolder.add(bloomParams, 'threshold', 0, 1)
            .name('Threshold')
            .onChange((value) => this.bloomPass.threshold = value);
        bloomFolder.open();

        const audioFolder = gui.addFolder('Engine Sound');
        const audioParams = {
            baseRate: this.basePitch,
            maxRate: this.maxPitch,
            reverseRate: this.reversePitch,
            baseGain: this.baseGain,
            maxGain: this.maxGain,
            reverseGain: this.reverseGain,
            refDistance: 10,
            maxSpeed: this.maxSpeed
        };
        audioFolder.add(audioParams, 'baseRate', 0.5, 2.0)
            .name('Idle Pitch')
            .onChange((value) => {
                this.basePitch = value;
                if (this.audioLoaded && this.engineSound.isPlaying && this.vehicle.wheelBodies[2].force.y === 0 && this.chassisBody.velocity.length() === 0) {
                    this.currentPitch = value;
                    this.engineSound.setPlaybackRate(value);
                }
            });
        audioFolder.add(audioParams, 'maxRate', 1.0, 4.0)
            .name('Max Pitch')
            .onChange((value) => this.maxPitch = value);
        audioFolder.add(audioParams, 'reverseRate', 0.5, 2.0)
            .name('Reverse Pitch')
            .onChange((value) => this.reversePitch = value);
        audioFolder.add(audioParams, 'baseGain', 0, 0.5)
            .name('Idle Volume')
            .onChange((value) => {
                this.baseGain = value;
                if (this.audioLoaded && this.engineSound.isPlaying && this.vehicle.wheelBodies[2].force.y === 0) {
                    this.engineSound.setVolume(value);
                }
            });
        audioFolder.add(audioParams, 'maxGain', 0, 1)
            .name('Max Volume')
            .onChange((value) => this.maxGain = value);
        audioFolder.add(audioParams, 'reverseGain', 0, 0.5)
            .name('Reverse Volume')
            .onChange((value) => this.reverseGain = value);
        audioFolder.add(audioParams, 'refDistance', 1, 50)
            .name('Reference Distance')
            .onChange((value) => {
                if (this.audioLoaded) {
                    this.engineSound.setRefDistance(value);
                }
            });
        audioFolder.add(audioParams, 'maxSpeed', 5, 50)
            .name('Max Speed for Pitch')
            .onChange((value) => this.maxSpeed = value);
        audioFolder.open();
    }

    toggleCamera() {
        if (this.cameraMode === 'orbit') {
            this.cameraMode = 'third';
            this.orbitControls.enabled = false;
        } else {
            this.cameraMode = 'orbit';
            this.orbitControls.enabled = true;
            this.orbitControls.update();
        }
    }

    toggleDebug() {
        this.showDebug = !this.showDebug;
    }

    toggleCameraDebug() {
        this.showCameraDebug = !this.showCameraDebug;
    }
}

export function init() {
    const vehicleScene = new VehicleScene();
    vehicleScene.loadVehicleModel('models/240sx/nissan_240sx.glb', 2);
    return vehicleScene;
}