import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PenTool, FileText, CheckCircle, Eye, Loader2 } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface DocInfo {
  id: string;
  file_name: string;
  document_type: string | null;
  project_name: string;
  file_signed_url: string | null;
}

export default function PublicSign() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<DocInfo | null>(null);
  const [signerName, setSignerName] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!token) return;
    const fetchDoc = async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/sign-document?token=${token}`,
          { headers: { apikey: SUPABASE_KEY } }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load document");
        setDoc(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [token]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    setHasSigned(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  const handleSubmit = async () => {
    if (!canvasRef.current || !hasSigned || !signerName || !token) return;
    setSubmitting(true);
    try {
      const signature_url = canvasRef.current.toDataURL("image/png");
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/sign-document`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
          body: JSON.stringify({ token, signature_url, signer_name: signerName }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit signature");
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="py-12 space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold">Signature Submitted!</h2>
            <p className="text-gray-500">Thank you for signing. You can close this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="py-12 space-y-4">
            <p className="text-red-500 font-medium">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5" /> Sign Document
          </CardTitle>
          <p className="text-sm text-gray-500">You've been asked to sign a document for <strong>{doc?.project_name}</strong>.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-3 rounded-lg border p-3 bg-gray-50">
            <FileText className="h-5 w-5 text-gray-400" />
            <div className="flex-1">
              <p className="text-sm font-medium">{doc?.file_name}</p>
              <p className="text-xs text-gray-400">{doc?.document_type || "Document"}</p>
            </div>
            {doc?.file_signed_url && (
              <Button variant="outline" size="sm" onClick={() => window.open(doc.file_signed_url!, "_blank")}>
                <Eye className="mr-1 h-3.5 w-3.5" /> View
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label>Your Full Name *</Label>
            <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Enter your full name" />
          </div>

          <div className="space-y-2">
            <Label>Signature *</Label>
            <div className="rounded-md border bg-white overflow-hidden">
              <canvas
                ref={canvasRef}
                width={440}
                height={160}
                className="w-full touch-none cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
            <p className="text-xs text-gray-400">Draw your signature above using mouse or touch.</p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={clearSignature} className="flex-1">Clear</Button>
            <Button onClick={handleSubmit} disabled={!hasSigned || !signerName || submitting} className="flex-1">
              {submitting ? "Submitting..." : "Submit Signature"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
