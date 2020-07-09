enum ForwardExit
{
    Distance,
    Obstacle
}

enum Command
{
    None = 0,
    Reset = 1,
    TrimLeft = 2,
    TrimRight = 4
}

const c_maxSpeed = 64
const c_slowSpeed = 32

const c_safetyDistance = 15
const c_goForwardDistance = 30
const c_maxDisplayDistance = 30

let g_Command : Command = Command.None
let g_scanDir = 1	
let g_leftTrim = 0
let g_rightTrim = 0

const c_backupMelody = ["C6:3", "R:3"]
const c_scanMelody = ["C3:1", "R:1", "C3:1", "R:1"]
const c_setupMelody = ["C5:1", "R:1", "C5:1", "R:1", "C5:1", "R:1"]

let pixel = neopixel.create(DigitalPin.P15, 4, NeoPixelMode.RGB)

basic.forever(function () {
	let exit = GoForward(c_maxSpeed, 0)
    switch(exit) {
        case ForwardExit.Distance:
            Scan()
            break
        
        case ForwardExit.Obstacle:
            Backtrack()
            break
    }
})

input.onButtonPressed(Button.A, function () {
    g_Command |= Command.TrimRight
})
input.onButtonPressed(Button.B, function () {
    g_Command |= Command.TrimLeft
})
input.onGesture(Gesture.Shake, function () {
    g_Command |= Command.Reset
})

function TrySetup()
{
    const c_setupTimeout = 2000
    let startTime = input.runningTime()

    if(g_Command == Command.None)
    {
        return
    }

    MotorStop()
    pixel.showColor(neopixel.rgb(0,0,0))
    music.stopMelody(MelodyStopOptions.All)

    do {
        if(g_Command & Command.Reset) {
            g_leftTrim = g_rightTrim = 0
            basic.showString("Reset")
            let startTime = input.runningTime()
        } else if(g_Command & Command.TrimRight) {
            g_rightTrim = Math.min(g_rightTrim + 1, c_maxSpeed)
            basic.showNumber(c_maxSpeed - g_rightTrim)  
            let startTime = input.runningTime()      
        } else if(g_Command & Command.TrimLeft) {
            g_leftTrim = Math.min(g_leftTrim + 1, c_maxSpeed)
            basic.showNumber(c_maxSpeed - g_leftTrim)
            let startTime = input.runningTime()
        }
        g_Command = Command.None
        basic.pause(100)
    } while (input.runningTime() - startTime < c_setupTimeout)

    music.startMelody(c_setupMelody, MelodyOptions.Once)
    basic.pause(2000)
}

function GoForward(speed: number, distanceInterval: number)
{
    console.log("GoForward")
	while (true) {
        TrySetup()
		let dist = GetDist(5, distanceInterval)
		maqueen.readPatrol(maqueen.Patrol.PatrolLeft)
	
		if (dist < c_safetyDistance) {
			MotorStop()
			return ForwardExit.Distance
		}

        let left = maqueen.readPatrol(maqueen.Patrol.PatrolLeft);
        let right = maqueen.readPatrol(maqueen.Patrol.PatrolRight);
        if(left == 0 || right == 0) {
            MotorStop()
            return ForwardExit.Obstacle
        }

		MotorRun(maqueen.Motors.All, maqueen.Dir.CW, speed)
	}
}

function MotorRun(motor: maqueen.Motors, dir: maqueen.Dir, speed: number)
{
    if(motor == maqueen.Motors.All &&
        dir == maqueen.Dir.CW &&
        (g_leftTrim > 0 || g_rightTrim > 0)) {
        
        maqueen.motorRun(maqueen.Motors.M1,dir, speed - g_leftTrim)
        maqueen.motorRun(maqueen.Motors.M2, dir, speed - g_rightTrim)
    }
    else
    {
        maqueen.motorRun(motor, dir, speed)
    }
}

function MotorStop()
{
    maqueen.motorStop(maqueen.Motors.All)
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

function Scan()
{
    console.log("Scan")
    music.startMelody(c_scanMelody, MelodyOptions.Once)
	const timeIncrement = 100
	let time = timeIncrement

	while(true) {
        TrySetup()

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
	 
	MotorRun(forwardMotor, maqueen.Dir.CW, c_maxSpeed)
	MotorRun(backwardMotor, maqueen.Dir.CCW, c_maxSpeed)

	basic.pause(ms)

    MotorStop()
}

function Backtrack()
{
    console.log("Backtrack")
    music.startMelody(c_backupMelody, MelodyOptions.ForeverInBackground)

    let motor = null
    while(true) {
        TrySetup()

        let left = maqueen.readPatrol(maqueen.Patrol.PatrolLeft);
        let right = maqueen.readPatrol(maqueen.Patrol.PatrolRight);

        // establish a direction
        if(motor == null) {
            if (left == 0 && right == 0) {
                motor = g_scanDir > 0 ? maqueen.Motors.M1 : maqueen.Motors.M2
                g_scanDir *= -1
            }
            else if(left == 0) {
                motor = maqueen.Motors.M2
            }
            else if(right == 0) {
                motor = maqueen.Motors.M1
            }
        }
        else if(left > 0 && right > 0) {
            break
        }
        MotorRun(motor, maqueen.Dir.CCW, c_slowSpeed)
        basic.pause(10)
    }

    // no longer obstacle. Back track a bit more.
    basic.pause(1000)
    MotorStop()
    music.stopMelody(MelodyStopOptions.All)
}