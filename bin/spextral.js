#!/usr/bin/env node

const { cmdInit } = require("../src/commands/init");
const { cmdDoctor } = require("../src/commands/doctor");
const { cmdUpdate } = require("../src/commands/update");
const { cmdNext } = require("../src/commands/next");

const command = process.argv[2];

switch (command) {
  case "init":
    cmdInit();
    break;
  case "doctor":
    cmdDoctor();
    break;
  case "update":
    cmdUpdate();
    break;
  case "next":
    cmdNext();
    break;
  default:
    console.log(`
  Spextral — Spec-Driven Development Protocol for AI Agents

  Usage:
    spextral init            Set up Spextral for one or more AI agents
    spextral doctor          Validate .sdd/ structure and artifacts
    spextral update          Fetch the latest spec from GitHub
    spextral next            Determine next logical step in the SDD workflow
    spextral next --quick    Fast-path: condensed flow with full autonomy
`);
    break;
}
