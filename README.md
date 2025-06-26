# Vehicle Simulation with Three.js and Cannon-es

This is a 3D vehicle simulation project built using Three.js for rendering and Cannon-es for physics. The project features a drivable car with a customizable camera system and a debug view, all managed with Vite for development and lil-gui for user interface controls.

## Note
- The vehicle models (e.g., nissan_240sx.glb) included in this project were downloaded for free from a third-party website. I do not own these models or hold the rights to redistribute them. They are provided here for demonstration purposes only within the context of this project.

## Features
- **Vehicle Physics**: A car with a chassis and four wheels, simulated using Cannon-es, with adjustable suspension and drifting mechanics.
- **Camera Modes**: Switch between a free-roaming OrbitControls camera and a third-person camera that follows the vehicle.
- **Debug Visualization**: Toggle visibility of physics debug wireframes for the chassis and wheels.
- **Drifting Inertia**: Enhanced vehicle inertia to maintain drifts after turning, with adjustable friction and momentum preservation.
- **GUI Controls**: Use lil-gui to toggle camera modes and debug visibility.

## Prerequisites
- Node.js (version 14 or higher)
- npm (comes with Node.js)

## Getting Started

### Installation
- Clone the repository or copy the project files to your local machine:
    ```bash
    git clone https://github.com/MrSully97/3der.git 
    cd 3der
    ```
    ```bash
    npm install
    ```

### Running
- Start the Vite development server
    ```bash
    npx vite
    ```
