
<p align="center">

<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>

<span align="center">

# Homebridge OpenSprinkler API

Homebridge plugin to control OpenSprinkler with HomeKit via the OpenSprinkler API as documented [here](https://openthings.freshdesk.com/support/solutions/articles/5000716363-os-api-documents).

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)


</span>

## Support

This plugin only supports OpenSprinkler firmware version 2.1.6 and above. If you aren't on one of these
firmware versions, you'll need to upgrade. If you're on one of the supported firmware versions and
the plugin still doesn't work, please open an issue on Github.

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
| `valves` | ✔️ | This is where you define your valves. OpenSprinkler's API is a little cryptic, so defining valves here makes things easier. Make sure you define your valves in the order they appear in the OpenSprinkler UI. Valves is an `Array` of objects that contain a `name` and `defaultDuration` property. Define like so: `"valves": [{ "name": "Front Yard", "defaultDuration": 300 }]`. Note: `defaultDuration` is defined in seconds. The config sets up the duration as the default for each valve, but you will be able to change the duration within the Home app after the fact. But every time you restart Homebridge, it will get reset to what's defined in the config. Also, HomeKit only allows numbers and letters in valve names. So don't include special characters. |
| `rainDelay` | | Define a rain delay number here in hours and that's what will be used with the switch in the Home app. If you choose not to define this property, the switch will not appear in HomeKit. |

## Future improvements

- Add the ability to run programs
