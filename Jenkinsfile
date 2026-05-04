pipeline {
    agent any

    options {
        timestamps()
    }

    environment {
        PATH = "/usr/local/bin:/opt/homebrew/bin:/Users/chehulchinnappa/.docker/bin:${env.PATH}"
        APP_NAME = 'nutrihelp-api'
        VERSION = "beta-${BUILD_NUMBER}"
        IMAGE_NAME = "${APP_NAME}:${VERSION}"
    }

    stages {
        
        stage('Build') {
            steps {
                echo "Building ${APP_NAME} version ${VERSION}"
                
                echo 'Checking Docker availability'
                sh 'docker --version'
                sh 'docker ps'

                echo 'Installing Node.js dependencies'
                sh 'npm install'

                echo 'Building Docker image artefact'
                sh 'docker build -t ${IMAGE_NAME} .'
                
                echo 'Listing created Docker image'
                sh 'docker images | grep ${APP_NAME}'
 
            }
        }


    }
}