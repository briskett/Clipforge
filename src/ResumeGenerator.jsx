import React, { useState, useEffect } from "react";
import { Button, TextField, Card, CardContent, CircularProgress } from "@mui/material";

const ResumeGenerator = () => {
    const [jobDescription, setJobDescription] = useState("");
    const [resume, setResume] = useState("Enter a job description to generate a resume.");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
            console.error("AdSense error:", e);
        }
    }, []);

    const generateResume = async () => {
        if (!jobDescription.trim()) return;

        setLoading(true);
        const response = await fetch("/api/generate-resume", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobDescription }),
        });

        const data = await response.json();
        setResume(data.resume);
        setLoading(false);
    };

    return (
        <div className="flex flex-col items-center p-4">
            {/* Ad Banner */}
            <div className="mb-4">
                <h1> Ad Banner Here</h1>
                <ins
                    className="adsbygoogle"
                    style={{ display: "block" }}
                    data-ad-client="your-ad-client-id"
                    data-ad-slot="your-ad-slot-id"
                    data-ad-format="auto"
                    data-full-width-responsive="true"
                ></ins>
            </div>

            {/* Resume Generator Card */}
            <Card sx={{ maxWidth: 500, width: "100%", padding: 2 }}>
                <CardContent>
                    <h2 className="text-xl font-bold mb-4">AI Resume Generator</h2>
                    <TextField
                        label="Job Description"
                        multiline
                        rows={4}
                        fullWidth
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                    />
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={generateResume}
                        disabled={loading}
                        sx={{ mt: 2 }}
                    >
                        {loading ? <CircularProgress size={24} /> : "Generate Resume"}
                    </Button>
                    <p className="mt-4 border p-2 rounded bg-gray-100">{resume}</p>
                </CardContent>
            </Card>
        </div>
    );
};

export default ResumeGenerator;
