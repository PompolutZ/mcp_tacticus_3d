import path from 'node:path'
import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as logs from 'aws-cdk-lib/aws-logs'
import type { Construct } from 'constructs'

const SITE_ORIGIN = 'https://mcptacticus3d.netlify.app'
const SSM_PREFIX = '/mcptacticus/prod/'
const repoRoot = path.resolve(import.meta.dirname, '../..')

export interface ApiStackProps extends StackProps {
  version: string
  // null: no reserved concurrency (the account quota is too low for it).
  reservedConcurrency: number | null
}

export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props)

    const logGroup = new logs.LogGroup(this, 'ApiLogs', {
      logGroupName: '/aws/lambda/mcptacticus-api',
      retention: logs.RetentionDays.ONE_WEEK,
    })

    const fn = new nodejs.NodejsFunction(this, 'Api', {
      functionName: 'mcptacticus-api',
      entry: path.join(repoRoot, 'apps/api/src/lambda.ts'),
      projectRoot: repoRoot,
      depsLockFilePath: path.join(repoRoot, 'pnpm-lock.yaml'),
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(10),
      logGroup,
      reservedConcurrentExecutions: props.reservedConcurrency ?? undefined,
      environment: {
        SSM_PREFIX,
        DB_NAME: 'assist3d',
        APP_VERSION: props.version,
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: {
        format: nodejs.OutputFormat.ESM,
        target: 'node24',
        mainFields: ['module', 'main'],
        minify: true,
        sourceMap: true,
        sourcesContent: false,
        // The mongodb driver is CommonJS and calls require() for Node built-ins.
        banner:
          "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
        // The Node 24 runtime has AWS SDK v3.
        externalModules: ['@aws-sdk/*'],
      },
    })

    // GetParametersByPath checks the ARN of the path itself, so both are needed.
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParametersByPath'],
        resources: ['parameter/mcptacticus/prod', 'parameter/mcptacticus/prod/*'].map(
          (resourceName) => this.formatArn({ service: 'ssm', resource: resourceName }),
        ),
      }),
    )

    // CORS is set here only. Hono's cors() would add every header a second time.
    const url = fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: [SITE_ORIGIN],
        allowedHeaders: ['authorization', 'content-type', 'x-after'],
        allowedMethods: [
          lambda.HttpMethod.GET,
          lambda.HttpMethod.POST,
          lambda.HttpMethod.PUT,
          lambda.HttpMethod.PATCH,
          lambda.HttpMethod.DELETE,
        ],
        maxAge: Duration.seconds(86400),
      },
    })

    // Atlas pauses a Free cluster after 30 days with no connection.
    new events.Rule(this, 'KeepAlive', {
      schedule: events.Schedule.rate(Duration.days(1)),
      targets: [
        new targets.LambdaFunction(fn, {
          event: events.RuleTargetInput.fromObject({ keepAlive: true }),
        }),
      ],
    })

    new CfnOutput(this, 'ApiUrl', { value: url.url })
  }
}
