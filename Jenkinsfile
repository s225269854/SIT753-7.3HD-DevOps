pipeline {
    agent any

    options {
        timestamps()
    }

    environment {
        APP_NAME = 'nutrihelp-api'
        IMAGE_TAG = "jenkins-${BUILD_NUMBER}"
        IMAGE_NAME = "${APP_NAME}:${IMAGE_TAG}"
    }

    stages {
        
        stage('Build') {
            steps {
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