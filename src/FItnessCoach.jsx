import React, { useState } from "react";
import { TextField, Button, Card, CardContent, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from "@mui/material";

const FitnessCoach = () => {
    const [workouts, setWorkouts] = useState([]);
    const [exercise, setExercise] = useState("");
    const [weight, setWeight] = useState("");
    const [reps, setReps] = useState("");
    const [sets, setSets] = useState("");
    const [recommendation, setRecommendation] = useState("");

    const handleAddWorkout = () => {
        if (!exercise || !weight || !reps || !sets) return;
        const newWorkout = { exercise, weight: Number(weight), reps: Number(reps), sets: Number(sets) };
        setWorkouts([...workouts, newWorkout]);
        generateRecommendation(newWorkout);
        setExercise("");
        setWeight("");
        setReps("");
        setSets("");
    };

    const generateRecommendation = (latestWorkout) => {
        let newRecommendation = "";
        if (latestWorkout.reps >= 6) {
            newRecommendation = `Increase weight for ${latestWorkout.exercise} by 5 lbs.`;
        } else if (latestWorkout.reps <= 3) {
            newRecommendation = `Decrease weight for ${latestWorkout.exercise} by 5 lbs.`;
        } else {
            newRecommendation = `Maintain current weight for ${latestWorkout.exercise}.`;
        }
        setRecommendation(newRecommendation);
    };

    return (
        <div style={{ maxWidth: 600, margin: "auto", padding: 20 }}>
            <Typography variant="h4" gutterBottom>AI Fitness Coach</Typography>
            <Card variant="outlined" style={{ marginBottom: 20 }}>
                <CardContent>
                    <Typography variant="h6">Log Your Workout</Typography>
                    <TextField label="Exercise" fullWidth margin="normal" value={exercise} onChange={(e) => setExercise(e.target.value)} />
                    <TextField label="Weight (lbs)" fullWidth margin="normal" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
                    <TextField label="Reps" fullWidth margin="normal" type="number" value={reps} onChange={(e) => setReps(e.target.value)} />
                    <TextField label="Sets" fullWidth margin="normal" type="number" value={sets} onChange={(e) => setSets(e.target.value)} />
                    <Button variant="contained" color="primary" fullWidth style={{ marginTop: 10 }} onClick={handleAddWorkout}>
                        Add Workout
                    </Button>
                </CardContent>
            </Card>

            {recommendation && (
                <Card variant="outlined" style={{ marginBottom: 20, backgroundColor: "#f3f3f3" }}>
                    <CardContent>
                        <Typography variant="h6">AI Recommendation</Typography>
                        <Typography>{recommendation}</Typography>
                    </CardContent>
                </Card>
            )}

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Exercise</TableCell>
                            <TableCell>Weight (lbs)</TableCell>
                            <TableCell>Reps</TableCell>
                            <TableCell>Sets</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {workouts.map((workout, index) => (
                            <TableRow key={index}>
                                <TableCell>{workout.exercise}</TableCell>
                                <TableCell>{workout.weight}</TableCell>
                                <TableCell>{workout.reps}</TableCell>
                                <TableCell>{workout.sets}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    );
};

export default FitnessCoach;