pipeline {
  agent any

  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '10'))
  }

  environment {
    PATH = "/usr/local/bin:/opt/homebrew/bin:/Users/chehulchinnappa/.docker/bin:${env.PATH}"
    JAVA_HOME = "/opt/homebrew/opt/openjdk@17"
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
        echo 'Archiving build metadata artifact'
        archiveArtifacts artifacts: 'build-info.txt', allowEmptyArchive: false
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
          echo 'Generating test coverage report'
          sh 'npm run test:coverage || true'
        }

        echo 'Publishing test results'
        junit testResults: 'test-results/*.xml', allowEmptyResults: true

        echo 'Publishing coverage report'
        publishHTML(target: [
          allowMissing: true,
          alwaysLinkToLastBuild: true,
          keepAll: true,
          reportDir: 'coverage/lcov-report',
          reportFiles: 'index.html',
          reportName: 'Coverage Report'
        ])
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

            echo 'Running SonarQube analysis'
        script {
            def scannerHome = tool 'sonar-scanner'
            withSonarQubeEnv('SonarQube') {
                sh """
                    ${scannerHome}/bin/sonar-scanner \
                      -Dsonar.projectKey=nutrihelp-api-hd \
                      -Dsonar.projectName="NutriHelp API HD Pipeline" \
                      -Dsonar.projectVersion=${VERSION} \
                      -Dsonar.sources=services,routes,middleware,server.js,test/ci\
                      -Dsonar.exclusions=**/node_modules/**,**/test/**,**/*.test.js,**/coverage/** \
                """
            }
        }

        echo 'Enforcing SonarQube quality gate'
        timeout(time: 3, unit: 'MINUTES') {
          waitForQualityGate abortPipeline: true
        }
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
            --ignore-unfixed \
            ${IMAGE_NAME}
        '''

        archiveArtifacts artifacts: 'audit-report.json,trivy-report.json', allowEmptyArchive: true
      }
    }

    stage('Deploy') {
          environment {
            STAGING_CONTAINER = 'nutrihelp-api-staging'
            STAGING_PORT = '8081'
          }

          steps {
            echo "Deploying ${IMAGE_NAME} to staging environment"

            withCredentials([
              string(credentialsId: 'supabase-url', variable: 'SUPABASE_URL'),
              string(credentialsId: 'supabase-anon-key', variable: 'SUPABASE_ANON_KEY'),
              string(credentialsId: 'supabase-service-role-key', variable: 'SUPABASE_SERVICE_ROLE_KEY')
            ]) {
              echo 'Stopping/Removing any existing staging container'
              sh 'docker rm -f ${STAGING_CONTAINER} || true'

              echo 'Starting new staging container'
              sh '''
                  docker run -d \
                    --name ${STAGING_CONTAINER} \
                    --restart unless-stopped \
                    -p ${STAGING_PORT}:80 \
                    -e NODE_ENV=staging \
                    -e PORT=80 \
                    -e HTTP_PORT=80\
                    -e HTTPS_PORT=443\
                    -e JWT_SECRET=jenkins-staging-secret \
                    -e SUPABASE_URL=${SUPABASE_URL} \
                    -e SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY} \
                    -e SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY} \
                    ${IMAGE_NAME}
              '''

              echo 'Waiting for the container'
              sh '''
                  echo "Polling health endpoint..."
                  for i in $(seq 1 12); do
                    if curl -sf http://localhost:${STAGING_PORT}/api/system/health; then
                      echo "\\nHealth check passed on attempt $i"
                      exit 0
                    fi
                    echo "Attempt $i failed, retrying in 5s..."
                    sleep 5
                  done
                  echo "Container failed to become healthy after 60 seconds"
                  docker logs ${STAGING_CONTAINER}
                  exit 1
              '''

              echo 'Staging container status'
              sh 'docker ps --filter "name=${STAGING_CONTAINER}" --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"'
            }
          }

          post {
            failure {
              echo 'Deploy failed — rolling back by stopping staging container'
              sh 'docker rm -f ${STAGING_CONTAINER} || true'
            }
          }
    }

    stage('Release') {
      environment {
        PROD_CONTAINER = 'nutrihelp-api-prod'
        PROD_PORT = '8082'
        PROD_HTTPS_PORT = '8443'
      }

      steps {
        echo "Promoting ${IMAGE_NAME} to production"

        sh '''
        docker tag ${IMAGE_NAME} ${APP_NAME}:stable
        docker tag ${IMAGE_NAME} ${APP_NAME}:${VERSION}-release
    '''

        echo 'Generating local TLS certificates'
        sh '''
        mkdir -p "${WORKSPACE}/certs"

        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
          -keyout "${WORKSPACE}/certs/local-key.pem" \
          -out "${WORKSPACE}/certs/local-cert.pem" \
          -subj "/CN=localhost"

        echo "Generated certificates:"
        ls -la "${WORKSPACE}/certs"
    '''

        withCredentials([
      string(credentialsId: 'supabase-url', variable: 'SUPABASE_URL'),
      string(credentialsId: 'supabase-anon-key', variable: 'SUPABASE_ANON_KEY'),
      string(credentialsId: 'supabase-service-role-key', variable: 'SUPABASE_SERVICE_ROLE_KEY')
    ]) {
          echo 'Stopping existing production container'
          sh 'docker rm -f ${PROD_CONTAINER} || true'

          echo 'Starting production container'
          sh '''
          docker run -d \
            --name ${PROD_CONTAINER} \
            --restart unless-stopped \
            -p ${PROD_PORT}:80 \
            -p ${PROD_HTTPS_PORT}:443 \
            -v "${WORKSPACE}/certs:/usr/src/app/certs:ro" \
            -e NODE_ENV=production \
            -e PORT=80 \
            -e HTTP_PORT=80 \
            -e HTTPS_PORT=443 \
            -e TLS_KEY_PATH=/usr/src/app/certs/local-key.pem \
            -e TLS_CERT_PATH=/usr/src/app/certs/local-cert.pem \
            -e JWT_SECRET=jenkins-prod-secret \
            -e SUPABASE_URL=${SUPABASE_URL} \
            -e SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY} \
            -e SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY} \
            ${APP_NAME}:stable

          echo "Container status after start:"
          docker ps -a --filter "name=${PROD_CONTAINER}"

          echo "Checking certs inside container:"
          docker exec ${PROD_CONTAINER} ls -la /usr/src/app/certs || true
      '''

          echo 'Verifying production deployment health'
          sh '''
          for i in $(seq 1 12); do
            if curl -k -sf https://localhost:${PROD_HTTPS_PORT}/api/system/health; then
              echo "\\nProduction HTTPS health check passed on attempt $i"
              exit 0
            fi

            if curl -sf http://localhost:${PROD_PORT}/api/system/health; then
              echo "\\nProduction HTTP health check passed on attempt $i"
              exit 0
            fi

            echo "Attempt $i failed, retrying in 5s..."
            sleep 5
          done

          echo "Production container failed health check"
          docker logs ${PROD_CONTAINER}
          exit 1
      '''

          echo 'Writing release notes'
          sh '''
          echo "RELEASE_VERSION=${VERSION}" > release-info.txt
          echo "RELEASE_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> release-info.txt
          echo "GIT_COMMIT=${GIT_COMMIT}" >> release-info.txt
          echo "SOURCE_IMAGE=${IMAGE_NAME}" >> release-info.txt
          echo "DEPLOYED_IMAGE=${APP_NAME}:stable" >> release-info.txt
          echo "HTTPS_URL=https://localhost:${PROD_HTTPS_PORT}/api/system/health" >> release-info.txt
          echo "ENVIRONMENT=production" >> release-info.txt
          cat release-info.txt
      '''

          archiveArtifacts artifacts: 'release-info.txt', allowEmptyArchive: false
    }
      }

      post {
        failure {
          echo 'Release failed — rolling back production container'
          sh 'docker rm -f ${PROD_CONTAINER} || true'
        }
      }
    }

    stage('Monitoring') {
      environment {
        PROD_CONTAINER = 'nutrihelp-api-prod'
        PROD_HTTP_PORT = '8082'
        PROD_HTTPS_PORT = '8443'
      }

      steps {
        echo 'Running post-deployment monitoring checks'

        echo 'Checking production HTTPS health endpoint'
        sh '''
        curl -k -sf https://localhost:${PROD_HTTPS_PORT}/api/system/health
    '''

        echo 'Checking container resource usage'
        sh '''
        docker stats ${PROD_CONTAINER} --no-stream \
          --format "table {{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}\\t{{.MemPerc}}" \
          > monitoring-stats.txt

        cat monitoring-stats.txt
    '''

        echo 'Collecting container logs for review'
        sh '''
        docker logs --tail 100 ${PROD_CONTAINER} > monitoring-logs.txt 2>&1 || true
        cat monitoring-logs.txt
    '''

        echo 'Checking for ERROR or WARN entries in logs'
        sh '''
        ERROR_COUNT=$(grep -ci "error" monitoring-logs.txt || true)
        WARN_COUNT=$(grep -ci "warn" monitoring-logs.txt || true)

        echo "Errors found: $ERROR_COUNT" > monitoring-summary.txt
        echo "Warnings found: $WARN_COUNT" >> monitoring-summary.txt

        cat monitoring-summary.txt

        if [ "$ERROR_COUNT" -gt 10 ]; then
          echo "Too many errors in production logs — review required"
          exit 1
        fi
    '''

        echo 'Simulating uptime checks across key endpoints'
        sh '''
        BASE=https://localhost:${PROD_HTTPS_PORT}

        echo "Endpoint Monitoring Results" > monitoring-endpoints.txt
        echo "===========================" >> monitoring-endpoints.txt

        for ENDPOINT in /api/system/health /api-docs; do
          STATUS=$(curl -k -o /dev/null -sw "%{http_code}" $BASE$ENDPOINT || echo "000")
          echo "Endpoint $ENDPOINT returned HTTP $STATUS" | tee -a monitoring-endpoints.txt
        done
    '''

        echo 'Archiving monitoring evidence'
        archiveArtifacts artifacts: 'monitoring-logs.txt,monitoring-stats.txt,monitoring-summary.txt,monitoring-endpoints.txt', allowEmptyArchive: true
      }
    }
  }

  post {
    success {
      echo "Pipeline completed successfully for ${IMAGE_NAME}"
      echo 'All stages passed — build, test, quality, security, deploy, release, monitoring'
    }
    failure {
      echo "Pipeline FAILED for ${IMAGE_NAME}"
      echo 'Check logs above for the failing stage'
    }
  }
}
