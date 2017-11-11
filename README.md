Lever
=====
Lever is a toy radius and diameter server and client for testing and experimentation. It is written in javascript and requires [nodejs](https://nodejs.org/).

This project does not include any license and is intended for personal use by the author only (see LICENSE file).

# Features

Lever uses [node radius](https://github.com/retailnext/node-radius) as a radius library and its own diameter library. It may act as a client, generating radius and diameter requests, or as a server, where requests are treated by custom handlers that may include any custom code.

In adition, a library is provided (codenamed "arm"), which provides some basic functionality for credit storage and discount, aimed at exposing a simple OCS (Online Charging System) interface, also for experimentation purposes.

Lever may be executed in a single node and be configured using local files, or may be deployed in a multinode setup where the shared configuration is stored in a mongodb database. The *arm* library always requires mongodb.

# Basic client installation
This setup is intended for building a radius/diameter client on a single node, typically used to generate testing loads.

First, install [nodejs](https://nodejs.org/)

Second, clone the repository using 

```git clone https://github.com/francistor/Lever.git```

go to ```Lever/lever/policyServer``` and update the dependencies unsing ```npm install```

The default configuration in lever/policyServer/conf/node.js sets lever as a radius client sending requests to a server in the localhost with secret "secret" (see file for details). With this default setup, a couple of utilities en the test directory are available for radius testing.

## runClientTest
```runClientTest.sh``` executes the tests specified in a template with the syntax show in ```clientTestSpec.js```. If run without any changes in configuration files (and using the default parameters), the test will show a failure due to the server not answering and the execution of a command to print the current date.

Use ```--help``` to check the available configuration options.

To configure the address of the server where to send the packets, secret, ports, etc. tune the ```Lever/lever/policyServer/conf/node.json``` configuration file.

## runRadiusLoad
```runRadiusLoad.sh``` sends a sequence or radius packets as specified in a template with the syntax shown in ```loadTemplate.json```. The template allows replacement of variables, to provide unique User-Names, Acct-Session-Ids, etc. per session, as well as random numbers. If vendor specific attributes are used, use ```loadTemplate-ArrayFormat.json``` as an example.

# Full setup
Install mongodb following the instructions in the mongodb site for your distribution.

Then, follow the steps in the basic installation.

To copy the example/test configuration in the database, go to the lever/database directory and execute ```toDatabase.sh```. This will populate the database with the contents of the files in the same directory, that include three radius/diameter nodes, named "client", "server" and "meta-server".

Go to the lever/policyServer/tools directory and execute ```disableLocalConfig.sh``` to make sure that the configuration is read from the database.

To check that the setup is OK, go to the lever/policyServer/test and execute ```runUnitTest.sh```. All thest should show [OK] instead of [ERROR]. Some traces showing errors when establishing connection with peers are expected, since the test configuration includes non-existing servers to test the balancing pools. Those errors do not include the [ERROR] mark.



