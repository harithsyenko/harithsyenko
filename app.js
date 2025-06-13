import * as THREE from './libs/three/three.module.js';
import { GLTFLoader } from './libs/three/jsm/GLTFLoader.js';
import { DRACOLoader } from './libs/three/jsm/DRACOLoader.js';
import { RGBELoader } from './libs/three/jsm/RGBELoader.js';
import { Stats } from './libs/stats.module.js';
import { LoadingBar } from './libs/LoadingBar.js';
import { VRButton } from './libs/VRButton.js';
import { CanvasUI } from './libs/CanvasUI.js';
import { GazeController } from './libs/GazeController.js';
import { XRControllerModelFactory } from './libs/three/jsm/XRControllerModelFactory.js';

class App {
  constructor() {
    const container = document.createElement('div');
    document.body.appendChild(container);

    this.assetsPath = './assets/';
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 500);
    this.camera.position.set(0, 1.6, 0);

    this.dolly = new THREE.Object3D();
    this.dolly.position.set(0, 0, 10);
    this.dolly.add(this.camera);
    this.dummyCam = new THREE.Object3D();
    this.camera.add(this.dummyCam);

    this.scene = new THREE.Scene();
    this.scene.add(this.dolly);

    const ambient = new THREE.HemisphereLight(0xffffff, 0xaaaaaa, 0.8);
    this.scene.add(ambient);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(this.renderer.domElement);
    this.setEnvironment();

    window.addEventListener('resize', this.resize.bind(this));

    this.clock = new THREE.Clock();
    this.up = new THREE.Vector3(0, 1, 0);
    this.origin = new THREE.Vector3();
    this.workingVec3 = new THREE.Vector3();
    this.workingQuaternion = new THREE.Quaternion();
    this.raycaster = new THREE.Raycaster();

    this.stats = new Stats();
    container.appendChild(this.stats.dom);

    this.loadingBar = new LoadingBar();
    this.immersive = false;
    this.currentLight = 'day';

    const self = this;
    fetch('./college.json')
      .then((res) => res.json())
      .then((obj) => {
        self.boardShown = '';
        self.boardData = obj;
      });

    this.loadCollege();
  }

  setEnvironment() {
    const loader = new RGBELoader().setDataType(THREE.UnsignedByteType);
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();

    loader.load('./assets/hdr/venice_sunset_1k.hdr', (texture) => {
      const envMap = pmremGenerator.fromEquirectangular(texture).texture;
      pmremGenerator.dispose();
      this.scene.environment = envMap;
    });
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  loadCollege() {
    const loader = new GLTFLoader().setPath(this.assetsPath);
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('./libs/three/js/draco/');
    loader.setDRACOLoader(dracoLoader);

    loader.load('college.glb', (gltf) => {
      const college = gltf.scene.children[0];
      this.scene.add(college);

      college.traverse((child) => {
        if (child.isMesh) {
          if (child.name.includes('PROXY')) {
            child.material.visible = false;
            this.proxy = child;
          } else if (child.material.name.includes('Glass')) {
            child.material.opacity = 0.1;
            child.material.transparent = true;
          } else if (child.material.name.includes('SkyBox')) {
            const mat1 = child.material;
            const mat2 = new THREE.MeshBasicMaterial({ map: mat1.map });
            child.material = mat2;
            mat1.dispose();
          }
        }
      });

      this.setupXR();
    });
  }

  setupXR() {
    this.renderer.xr.enabled = true;
    const btn = new VRButton(this.renderer);

    const timeoutId = setTimeout(() => {
      this.useGaze = true;
      this.gazeController = new GazeController(this.scene, this.dummyCam);
    }, 2000);

    const onSelectEnd = (event) => {
      if (event.inputSource && event.inputSource.handedness === 'right') {
        if (this.currentLight === 'day') {
          this.scene.background = new THREE.Color(0x000011);
          this.scene.environment = null;
          this.currentLight = 'night';
        } else {
          this.setEnvironment();
          this.currentLight = 'day';
        }
      }
    };

    this.controllers = this.buildControllers(this.dolly);
    this.controllers.forEach((controller) => {
      controller.addEventListener('selectend', onSelectEnd);
    });

    this.renderer.setAnimationLoop(this.render.bind(this));
  }

  buildControllers(parent = this.scene) {
    const factory = new XRControllerModelFactory();
    const controllers = [];
    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      controller.userData.selectPressed = false;
      parent.add(controller);
      controllers.push(controller);

      const grip = this.renderer.xr.getControllerGrip(i);
      grip.add(factory.createControllerModel(grip));
      parent.add(grip);
    }
    return controllers;
  }

  render() {
    this.stats.update();
    this.renderer.render(this.scene, this.camera);
  }
}

export { App };
