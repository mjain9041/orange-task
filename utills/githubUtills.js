const { gql } = require('graphql-request');
const { getGraphqlClient } = require('../helpers/graphqlClient');
const { Octokit } = require("@octokit/rest");
const CONSTANTS = require('../helpers/constants');
const util = require('../validations/checkFileName');


class GithubUtills {

  constructor() {
    console.log('[INFO] RepositoriesService init');
    this.graphqlClient = getGraphqlClient();
  }

  //get list of user repositories
  async getRepositories(repoOwnerName, maxRepos = 50) {
    const variables = {};
    const query = gql`{
      repositoryOwner(login: "${repoOwnerName}") {
        repositories(first: ${maxRepos}) {
          nodes {
            name
            diskUsage
            owner {          
              login
            }
          }
        }
      }
    }`;
    const data = await this.graphqlClient.request(query, variables);
    const { nodes } = data.repositoryOwner.repositories;
    let response = [];
    nodes.map((node) => {
      const { name, diskUsage } = node;
      const { login } = node.owner;
      response.push({
        "Repository Name": name,
        "Repository Size":diskUsage,
        "Repository Owner":login
      });
    });
    return response;
  }

  //get repository details
  async getRepositoryDetails(repoOwnerName, repoName, maxRepos = 50) { 
    const variables = {};
    const query = gql`{
      repository(owner: "${repoOwnerName}", name: "${repoName}") {
        name
        diskUsage
        isPrivate
        owner {
          login
        }   
        object(expression: "HEAD:") {
          ... on Tree {
            entries {
              name
              type
              object {
                ... on Blob {
                  byteSize                  
                }
                ... on Tree {
                  entries {
                    name
                    type
                    object {
                      ... on Blob {
                        byteSize                        
                      }
                    }
                  }
                }
              }
            }
          }
        }        
      }  
    }
  `;
    const data = await this.graphqlClient.request(query, variables);

    let response = [];

      const { name, diskUsage, isPrivate } = data.repository;
      const { login } = data.repository.owner;    
      let entries = JSON.parse(JSON.stringify(data.repository.object)); 
      const  {folderCount,fileCount} = await this.getNoOfFiles(entries);   
      const activeWebhooks = await this.getActiveWebhooks(repoOwnerName, repoName );  
      const {text,haveYmlFile} = await this.haveYmlFiles(entries,repoOwnerName,repoName);

      response.push({
        "Repository Name": name,
        "Repository Size":diskUsage,
        "Repository Owner":login,
        "Repository is Private":isPrivate,
        "Number of Files on Root Level":fileCount,  
        "Number of Folders on Root Level":folderCount,
        "Have YML File":haveYmlFile,
        "Content of YML File":text,
        "Active Webhooks":activeWebhooks     
      });
     

    return response;
  }


  //function to check if yml file is present in the root of repository
  async haveYmlFiles (filesArr,repoOwnerName,repoName) {    
   
    let text = '';
    for(var i=0;i<filesArr.entries.length;i++){ 
      let splitArr = filesArr.entries[i].name.split('.');
      if(splitArr[1]){        
        if(await util.validateFileExtension(filesArr.entries[i].name,CONSTANTS.YML_EXTENSION)) {      
          //get yml file content
          let variables = {};
          let query = gql`{repository(owner: "${repoOwnerName}", name: "${repoName}") {
            content: object(expression: "HEAD:${splitArr[0]}.yml") {
              ... on Blob {
                text
              }
            }
          }}`;
          let data = await this.graphqlClient.request(query, variables);
          return {text:data.repository.content.text,haveYmlFile:true}; 
       }  
      }        
    }   
    return {text:text,haveYmlFile:false}; 
  }

  //function to get number of files in 1st level of repository
  async getNoOfFiles(filesArr) {
    let files = 0;
    let folders = 0;

    const listOf1stLevelFiles = filesArr.entries.filter(it => it.type === 'blob');
    const listofDirectories = filesArr.entries.filter(it => it.type === 'tree');

    files += listOf1stLevelFiles.length;
    folders += listofDirectories.length;   

    return {folderCount:folders, fileCount:files };
  }

  //function to get active webhooks
  async getActiveWebhooks(repoOwnerName, repoName ) {
      const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
      });

      try{
        const response = await octokit.rest.repos.listWebhooks({
          owner: repoOwnerName,
          repo: repoName
        })

        if(response.data.length < 1){
          return CONSTANTS.NO_ACTIVE_WEBHOOK;	
        } else {
          return res.data;
        }
      } catch(err) {
        return CONSTANTS.NO_ACTIVE_WEBHOOK;
      }
  }

}



module.exports = GithubUtills;
