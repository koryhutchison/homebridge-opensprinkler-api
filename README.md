
<p align="center">

<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>

<span align="center">

# Homebridge OpenSprinkler API

Homebridge plugin to control OpenSprinkler with HomeKit via the OpenSprinkler API as documented [here](https://openthings.freshdesk.com/support/solutions/articles/5000716363-os-api-documents).

</span>

## Installation

Install via the Homebridge UI for the easiest experience. Search under the "Plugins" tab for `homebridge-opensprinkler-api` and click "Install".

## Configuration

Here are the required and optional parameters you can define in the config:

| Name | Required? | Description |
| ---- | :-------: | ----------- |
| `platform` | ✔️ | This is the name that's used to register the plugin with Homebridge. It needs to be `HomebridgeOpenSprinklerApi`. |
| `password` | ✔️ | This is how you define your password for your OpenSprikler system. You can either provide it in `md5` form, or in plain text. So `password` would be defined like so if using `md5`: `"password": { "md5": "<hash>" }`. If using a plain text password: `"password": { "plain": "<password>" }`. |
| `host` | ✔️ | The host of your OpenSprinkler system. For example: `192.168.1.2`. I would recommend using the IP address of the unit instead of a local hostname. |
| `pollInterval` | | A number in seconds of how often you want to make requests to OpenSprinkler to get updates. The default is `15` seconds. |
| `valves` | ✔️ | This is where you define your valves. OpenSprinkler's API is a little cryptic, so defining valves here makes things easier. Make sure you define your valves in the order they appear in the OpenSprinkler UI. Valves is an `Array` of objects that contain a `name` and `defaultDuration` property. Define like so: `"valves": [{ "name": "Front Yard", "defaultDuration": 300 }]`. Note: `defaultDuration` is defined in seconds. Also, HomeKit only allows numbers and letters in valve names. So don't include special characters. |
