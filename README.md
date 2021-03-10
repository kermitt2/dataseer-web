# DataSeer-Web

![Logo DataSeer](public/img/DataSeer-logo-75.png "Logo")

## Purposes

This repository corresponds to the DataSeer web application, which aims at driving the authors of scientific article/manuscripts to the best research data sharing practices, i.e. to ensure that the datasets coming with an article are associated with data availability statement, permanent identifiers and in general requirements regarding Open Science and reproducibility. 

Machine learning techniques are used to extract and structure the information of the scientific article, to identify contexts introducting datasets and finally to classify these context into predicted data types and subtypes. These ML predictions are used by the web application to help the authors to described in an efficient and assisted manner the datasets used in the article and how these data are shared with the scientific community. 

See the [dataseer-ml](https://github.com/dataseer/dataseer-ml) repository for the machine learning services used by DataSeer web.

Supported article formats are PDF, docx, TEI, JATS/NLM, ScholarOne, and a large variety of additional publisher native XML formats: BMJ, Elsevier staging format, OUP, PNAS, RSC, Sage, Wiley, etc (see [Pub2TEI](https://github.com/kermitt2/Pub2TEI) for the list of native publisher XML format covered).

## Implementation

MongoDB is used to store every data of documents.

FileSystem is used to store every files.

Express is used to create the http server.

## Contact and License

Main authors and contact: [Nicolas Kieffer](https://github.com/NicolasKieffer), Patrice Lopez (<patrice.lopez@science-miner.com>).

The development of dataseer-ml is supported by a [Sloan Foundation](https://sloan.org/) grant, see [here](https://coko.foundation/coko-receives-sloan-foundation-grant-to-build-dataseer-a-missing-piece-in-the-data-sharing-puzzle/).

dataseer-Web is distributed under [Apache2 license](https://www.apache.org/licenses/LICENSE-2.0).

---

## Description

The project provides: 

  - a web application to process documents stored in MongoDB database: `localhost:3000/`
  - a back office for uploading manually documents to be processed: `localhost:3000/backoffice/`
  - a REST api to load and modify documents data (CRUD): `localhost:3000/api`

## Documentations

  - [Install](#install)
  - [Run](#run)
  - [Dependencies](#dependencies)
  - [Configuration](#configuration)
    - [Web Application configuration](#web-application)
    - [SMTP configuration](#smtp)
    - [JWT Configuration](#json-web-token)
  - [Models documentation](doc/MODELS.md#models-documentation)
    - [Accounts](doc/MODELS.md#accounts)
    - [Organisations](doc/MODELS.md#organisations)
    - [Roles](doc/MODELS.md#roles)
    - [Documents](doc/MODELS.md#documents)
      - [Documents Metadata](doc/MODELS.md#documents-metadata)
      - [Documents Datasets](doc/MODELS.md#documents-datasets)
      - [Documents Files](doc/MODELS.md#documents-files)
      - [Documents Logs](doc/MODELS.md#documents-logs)
  - [Web Application documentation](doc/WEBAPP.md#web-application-documentation)
    - [Responses Status Codes](doc/WEBAPP.md#response-status-codes)
    - [Credentials](doc/WEBAPP.md#credentials)
    - [Results](doc/WEBAPP.md#results)
    - [Routes](doc/WEBAPP.md#routes)
  - [API documentation](doc/API.md#api-documentation)
    - [Responses Status Codes](doc/API.md#response-status-codes)
    - [Credentials](doc/API.md#credentials)
    - [Results](doc/API.md#results)
    - [Routes](doc/API.md#routes)

## Install

*[Table of contents](#documentations)*

Run this command to install dataseer-web app.

``npm i``

## Run

*[Table of contents](#documentations)*

Run this command to start dataseer-web app.

``npm start``

## Dependencies

*[Table of contents](#documentations)*

Application requires an instance of mongoDB running on port `27017`, with an `app` database (`conf/conf.json` to set complete URL).

## Configuration

### Web Application

*[Table of contents](#documentations)*

Web app [default configuration file](/conf/conf.default.json). You must create file conf/conf.json and fill it with data like below:

```js
{
  "services": {
    "mongodb": "mongodb://localhost:27017/app",
    "dataseer-ml": "http://localhost/dataseer-ml/service",
    "curator-email": "curator@mydomain.ai"
  },
  "emails": {
    "upload": "info@dataseer.ai"
  },
  "FileSystemRoot": "./data",
  "root": "http://localhost:3000/",
  "_reCAPTCHA_site_key_": {
    "public": "publicKey",
    "private": "privateKey"
  },
  "_reCAPTCHA_score_": {
    "limit": 0.75,
    "error": "Authentication failed (captcha score too low)"
  },
  "tokens": {
    "api": {
      "expiresIn": 2592000 // 60 days
    },
    "documents": {
      "expiresIn": 2592000, // 60 days
      "accountId": "Account ID that will be used for logs"
    },
    "resetPassword": {
      "expiresIn": 3600// 1 hour
    },
    "automaticAccountCreation": {
      "expiresIn": 604800 // 7 days
    }
  }
}
```

### SMTP

*[Table of contents](#documentations)*

Application requires a SMTP server to send some emails (resest password, API token, automatique account creation)

SMTP [default configuration file](/conf/smtp.conf.default.json). You must create file conf/smtp.conf.json and fill it with data like below:

```js
{
  "host": "smtp.default.com",
  "port": 587,
  "auth": {
    "user": "user@default.com",
    "pass": "pass"
  },
  "from": "\"Fred Foo\" <foo@example.com>"
}
```

### Json Web Token

*[Table of contents](#documentations)*

Application requires a private key to create JSON Web Token.

You must create file conf/private.key and fill it with a string.
