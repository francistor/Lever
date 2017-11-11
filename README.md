Lever
=====
Lever is a toy radius and diameter server and client for testing and experimentation.

This project does not include any license and is intended for personal use by the author only (see LICENSE file).

# Features

Lever uses [node radius](https://github.com/retailnext/node-radius) as a radis library and its own diameter library. It may act as a client, generating radius and diameter requests, or as a server, where requests are treated by custom handlers that may include any custom code.

In adition, a library is provided (codenamed "arm"), which provides some basic functionality for credit storage and discount, aimed at exposing a simple OCS (Online Charging System) interface, also for experimentation purposes.

Lever may be executed in a single node and be configured using local files, or may be deployed in a multinode setup where the shared configuration is stored in a mongodb database. The *arm* library always requires mongodb.

# Basic client installation

This setup is intended for building a radius/diameter client on a single node, typically used to generate testing loads.

First, clone the repository using 

```git clone https://github.com/francistor/Lever.git```




