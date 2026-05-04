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
        sh "docker images | grep ${APP_NAME}"
      }
    }

    stage('Test') {
      environment {
        NODE_ENV = 'test'
        JWT_SECRET = 'jenkins-test-secret'
        PORT = '8081'
      }

      steps {
        echo 'Running CI-focused automated tests'

        withCredentials([
          string(credentialsId: 'supabase-url', variable: 'SUPABASE_URL'),
          string(credentialsId: 'supabase-anon-key', variable: 'SUPABASE_ANON_KEY'),
          string(credentialsId: 'supabase-service-role-key', variable: 'SUPABASE_SERVICE_ROLE_KEY')
        ]) {
          echo 'Running stable CI test suite with valid, invalid, and edge case coverage'
          sh 'npm run test:ci'
        }
      }
    }

    stage('Code Quality') {
        steps {
            echo 'Running code quality checks'

            echo 'Checking linting rules'
            sh 'npm run lint:ci'

            echo 'Checking code formatting'
            sh 'npm run format:check'

            echo 'Validating OpenAPI specification'
            sh 'npm run openapi:validate'
        }
    }

    stage('Security') {
    steps {
        echo 'Running npm dependency security audit'
        sh 'npm audit --audit-level=high'

        echo 'Saving npm audit report'
        sh 'npm audit --json > audit-report.json || true'

        echo 'Running Trivy Docker image scan and saving report'
        sh '''
            trivy image \
              --severity HIGH,CRITICAL \
              --no-progress \
              --format json \
              --output trivy-report.json \
              ${IMAGE_NAME} || true
        '''

        echo 'Checking for critical Docker image vulnerabilities'
        sh '''
            trivy image \
              --severity CRITICAL \
              --exit-code 1 \
              --no-progress \
              ${IMAGE_NAME}
        '''

        archiveArtifacts artifacts: 'audit-report.json,trivy-report.json', allowEmptyArchive: true
    }
}

  }
}