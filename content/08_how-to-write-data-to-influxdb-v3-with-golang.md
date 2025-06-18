+++
title = "How to Write Data to InfluxDB v3 with GoLang"
slug = "how-to-write-data-to-influxdb-v3-with-golang"
date = 2024-05-14
aliases = ["/how-to-write-data-to-influxdb-v3-with-golang-a-step-by-step-tutorial-f32b0d3ea930", "/posts/how-to-write-data-to-influxdb-v3-with-golang"]

[taxonomies]
categories = ["IIoT"]
tags = ["influxdb", "v3", "iiot", "manufacturing", "iot"]
+++

In this blog post, we’ll delve into the process of writing data into InfluxDB v3 using Go. Our focus will be on harnessing the capabilities of the [influxdb3-go client library](https://github.com/InfluxCommunity/influxdb3-go/tree/main), particularly its support for annotated structs. Through a practical example, we’ll demonstrate how to convert a slice into a structured format and efficiently batch write it into InfluxDB.

<!-- more -->

<center>
<img src="/images/how-to-write-data-to-influxdb-v3-with-golang/1.webp" style="width: 100%"/>
</center>
<br>

<details>
<summary><b>Table of Contents</b></summary>

<!-- vim-markdown-toc GFM -->

- [Setting Up a Go Project for IIoT Measurements: A Step-by-Step Guide](#setting-up-a-go-project-for-iiot-measurements-a-step-by-step-guide)
- [Implementing Annotated Structs for InfluxDB Data Writing](#implementing-annotated-structs-for-influxdb-data-writing)
- [Loading InfluxDB Credentials from Environment Variables](#loading-influxdb-credentials-from-environment-variables)
- [Instantiating the InfluxDB Client](#instantiating-the-influxdb-client)
- [Implementing Batch Write Function for InfluxDB Data](#implementing-batch-write-function-for-influxdb-data)
- [Writing Data to InfluxDB v3](#writing-data-to-influxdb-v3)
- [Exploring Data](#exploring-data)
- [Conclusion](#conclusion)
- [References](#references)
  
<!-- vim-markdown-toc -->

</details>
<br>

# Setting Up a Go Project for IIoT Measurements: A Step-by-Step Guide

Let’s kickstart by initializing a Go project named iiot-measurements and structuring it with three essential files:

1. `main.go`: Responsible for the main function.
2. `influxdb3.go`: Contains the struct and functions for InfluxDB writing.
3. `config.go`: Handles the loading of InfluxDB credentials from the environment.

Here’s how to set up the project:

```bash
mkdir iiot-measurements && cd iiot-measurements && go mod init iiot-measurements
```

Next, let’s install the latest influxdb3 Go client:

```bash
go get github.com/InfluxCommunity/influxdb3-go
```

# Implementing Annotated Structs for InfluxDB Data Writing

With the influxdb3-go client, data can be provided in various formats such as [line protocol](https://docs.influxdata.com/influxdb/cloud-serverless/reference/syntax/line-protocol/), point, or as a struct. For this tutorial, we’ll opt for the annotated struct approach to ensure a fixed schema. This choice suits scenarios where maintaining a consistent schema is crucial. However, if your use case involves handling dynamic schemas, other options like line protocol or point may be more suitable.

<center>
<img src="/images/how-to-write-data-to-influxdb-v3-with-golang/2.png" style="width: 90%"/>
</center>
<br>

# Loading InfluxDB Credentials from Environment Variables

Before instantiating the InfluxDB client, it’s essential to load the credentials from the environment. To achieve this, we’ll utilize the env package to parse environment variables into our InfluxdbConfig struct. Additionally, we’ll create a NewConfig() function to facilitate the instantiation of the struct.

```bash
go get github.com/caarlos0/env/v11
```

<center>
<img src="/images/how-to-write-data-to-influxdb-v3-with-golang/3.png" style="width: 90%"/>
</center>
<br>

# Instantiating the InfluxDB Client

After loading the credentials, the next step is to create a function that instantiates the InfluxDB client. We’ll define a NewClient() function responsible for this task, utilizing the configuration struct previously defined. This function ensures seamless creation of the client with the provided configuration.

<center>
<img src="/images/how-to-write-data-to-influxdb-v3-with-golang/4.png" style="width: 90%"/>
</center>
<br>

# Implementing Batch Write Function for InfluxDB Data

After setting up the InfluxDB client instantiation, the next step is to implement a function for batch writing data to InfluxDB v3. We’ll create a function named BatchWrite() responsible for this task. This function will take a slice of annotated Measurement structs and convert them into an []interface{} format, facilitating batch writing to InfluxDB v3.

<center>
<img src="/images/how-to-write-data-to-influxdb-v3-with-golang/5.png" style="width: 90%"/>
</center>
<br>

# Writing Data to InfluxDB v3

With all the required functions in place, we are now ready to instantiate the client and write a slice of data to InfluxDB v3. First, we’ll initialize the client using the configuration obtained from environment variables. Then, we’ll utilize the BatchWrite() function to efficiently write the data as a batch to InfluxDB.

<center>
<img src="/images/how-to-write-data-to-influxdb-v3-with-golang/6.png" style="width: 80%"/>
</center>
<br>

# Exploring Data

<center>
<img src="/images/how-to-write-data-to-influxdb-v3-with-golang/7.webp" style="width: 100%"/>
</center>
<br>

# Conclusion

In this tutorial, we’ve explored the process of writing data to InfluxDB v3 using GoLang and the influxdb3-go client library. By leveraging annotated structs and environment-based configuration loading, we’ve established a robust foundation for efficiently managing InfluxDB data within Go applications.

We began by setting up a Go project and initializing the InfluxDB client with credentials loaded from environment variables. Through the implementation of a BatchWrite() function, we demonstrated how to streamline the process of writing data in batches to InfluxDB v3.

By following the steps outlined in this tutorial, you’re now equipped with the knowledge to seamlessly integrate InfluxDB data writing capabilities into your Go applications, ensuring reliability and scalability for your time-series data management needs.

# References

- [https://github.com/thulasirajkomminar/iiot-measurements-influxdb3](https://github.com/thulasirajkomminar/iiot-measurements-influxdb3)
- [https://github.com/InfluxCommunity/influxdb3-go/blob/main/README.md](https://github.com/InfluxCommunity/influxdb3-go/blob/main/README.md)
- [https://docs.influxdata.com/influxdb/cloud-serverless/reference/syntax/line-protocol/](https://docs.influxdata.com/influxdb/cloud-serverless/reference/syntax/line-protocol/)
