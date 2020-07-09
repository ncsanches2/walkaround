enum ForwardExit
{
    Distance,
    Obstacle
}

const c_maxSpeed = 64
const c_slowSpeed = 32

const c_safetyDistance = 15
const c_goForwardDistance = 30
const c_maxDisplayDistance = 30

const c_backupMelody = ["C6:3", "R:3"]
const c_scanMelody = ["C3:1", "R:1", "C3:1", "R:1"]

let pixel = neopixel.create(DigitalPin.P15, 4, NeoPixelMode.RGB)

basic.forever(function () {
	let exit = GoForward(c_maxSpeed, 0)
    switch(exit) {
        case ForwardExit.Distance:
            // GoForward(c_slowSpeed, 200)
            Scan()
            break
        
        case ForwardExit.Obstacle:
            Backtrack()
            break
    }
})

function GoForward(speed: number, distanceInterval: number)
{
	while (true) {
		let dist = GetDist(5, distanceInterval)
		maqueen.readPatrol(maqueen.Patrol.PatrolLeft)
	
		if (dist < c_safetyDistance) {
			maqueen.motorStop(maqueen.Motors.All)
			return ForwardExit.Distance
		}

        let left = maqueen.readPatrol(maqueen.Patrol.PatrolLeft);
        let right = maqueen.readPatrol(maqueen.Patrol.PatrolRight);
        if(left == 0 || right == 0) {
            maqueen.motorStop(maqueen.Motors.All)
            return ForwardExit.Obstacle
        }

		maqueen.motorRun(maqueen.Motors.All, maqueen.Dir.CW, speed)
	}
}

function GetDist(samples: number, interval: number = 0) 
{
    let r = Math.random() * 255
    let g = Math.random() * 255
    let b = Math.random() * 255

    pixel.showColor(neopixel.rgb(r, g, b))

	let sum = 0
	for (let i = 0; i < samples; i++) {
		sum += maqueen.Ultrasonic(PingUnit.Centimeters)
		basic.pause(interval)
	}
	let dist = sum / samples
	led.plotBarGraph(dist, c_maxDisplayDistance)
	return dist
}

let g_scanDir = 1	

function Scan()
{
    music.startMelody(c_scanMelody, MelodyOptions.Once)
	const timeIncrement = 100
	let time = timeIncrement

	while(true) {
		g_scanDir *= -1
		Rotate(g_scanDir, time)
		let dist = GetDist(10, 50)
		if (dist > c_goForwardDistance) {
			break
		}
		time += timeIncrement
	}

    music.stopMelody(MelodyStopOptions.All)
}

function Rotate(dir: number, ms: number)
{
	let forwardMotor = dir < 0 ? maqueen.Motors.M1 : maqueen.Motors.M2 
	let backwardMotor = dir < 0 ? maqueen.Motors.M2 : maqueen.Motors.M1
	 
	maqueen.motorRun(forwardMotor, maqueen.Dir.CW, c_maxSpeed)
	maqueen.motorRun(backwardMotor, maqueen.Dir.CCW, c_maxSpeed)

	basic.pause(ms)

	maqueen.motorStop(maqueen.Motors.All)
}

function Backtrack()
{
    music.startMelody(c_backupMelody, MelodyOptions.ForeverInBackground)

    let motor = null
    while(true) {
        let left = maqueen.readPatrol(maqueen.Patrol.PatrolLeft);
        let right = maqueen.readPatrol(maqueen.Patrol.PatrolRight);

        // establish a direction
        if(motor == null) {
            if (left == 0 && right == 0) {
                motor = g_scanDir > 0 ? maqueen.Motors.M1 : maqueen.Motors.M2
            }
            else if(left == 0) {
                motor = maqueen.Motors.M2
            }
            else if(right == 0) {
                motor = maqueen.Motors.M1
            }
        }
        else if(left > 0 && right > 0) {
            // no longer obstacle. Back track a bit more.
            basic.pause(1000)
            maqueen.motorStop(maqueen.Motors.All)
            break
        }
        maqueen.motorRun(motor, maqueen.Dir.CCW, c_slowSpeed)
    }
    music.stopMelody(MelodyStopOptions.All)
}