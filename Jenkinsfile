pipeline {
    agent any

    options {
        timestamps()
        buildDiscarder(logRotator(numToKeepStr: '10'))
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

                 echo 'Writing build metadata...'
                sh '''
                    echo "APP_NAME=${APP_NAME}" > build-info.txt
                    echo "VERSION=${VERSION}" >> build-info.txt
                    echo "IMAGE_NAME=${IMAGE_NAME}" >> build-info.txt
                    echo "BUILD_NUMBER=${BUILD_NUMBER}" >> build-info.txt
                    echo "GIT_COMMIT=${GIT_COMMIT}" >> build-info.txt
                    cat build-info.txt
                '''

                echo 'Listing created Docker image...'
                sh 'docker images | grep ${APP_NAME}'
 
            }
        }
        stage('Test') {
            steps {
                echo 'Running automated test'

                echo 'Running unit tests'
                sh 'npm run test:unit'

                echo 'Running full automated test excluding contract tests'
                sh 'npm test'

                echo 'Running contract tests'
                sh 'npm run test:contract'
            }
        }


    }
}