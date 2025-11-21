import { Link, useNavigate } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { usePortalText } from '../theme/PortalTextProvider';

export default function Home() {
  const [showSignup, setShowSignup] = useState(true);
  const [loadingSignup, setLoadingSignup] = useState(true);
  const { text: portalText, loading: textLoading } = usePortalText();
  const [isUserLoginTransitioning, setIsUserLoginTransitioning] = useState(false);
  const navigate = useNavigate();

  const handleUserLoginClick = (event?: React.MouseEvent) => {
    event?.preventDefault?.();
    if (isUserLoginTransitioning) return;

    setIsUserLoginTransitioning(true);

    const userLoginPath = "/login";

    setTimeout(() => {
      navigate(userLoginPath);
    }, 450);
  };

  useEffect(() => {
    let mounted = true;

    async function fetchAllowSignup(): Promise<boolean> {
      const { data, error } = await supabase
        .from('portal_settings')
        .select('value')
        .eq('key', 'allow_signup')
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116: row not found, which is not a critical error here
        console.error("Error fetching signup setting:", error.message);
        return true; // Default to showing the button on error (fail-open)
      }
      
      // Default to true if no record exists (data is null) or use the stored value.
      return data ? !!data.value : true;
    }

    fetchAllowSignup().then(value => {
      if (mounted) {
        setShowSignup(value);
      }
    }).finally(() => {
      if (mounted) {
        setLoadingSignup(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);
  
  const baseButtonClasses = "aurora-btn relative inline-flex items-center justify-center px-10 py-3 rounded-2xl font-semibold tracking-wide text-sm md:text-base text-white overflow-hidden backdrop-blur-xl bg-white/10 border border-white/20 shadow-[0_8px_25px_rgba(0,0,0,0.4)] transition-all duration-500 hover:-translate-y-0.5 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";

  return (
    <>
      <style>{`
        @keyframes gradientShift {
          0%   { transform: translate3d(0,0,0) scale(1); }
          50%  { transform: translate3d(-2%, -1%, 0) scale(1.02); }
          100% { transform: translate3d(0,0,0) scale(1); }
        }
        .animate-gradient-bg {
          animation: gradientShift 18s ease-in-out infinite;
        }
        @keyframes auroraMove {
          0% { transform: translate3d(-50%, -60%, 0) rotate(0deg); }
          50% { transform: translate3d(0%, -20%, 0) rotate(45deg); }
          100% { transform: translate3d(50%, -60%, 0) rotate(90deg); }
        }

        .aurora-btn::before {
          content: "";
          position: absolute;
          inset: -40%;
          border-radius: inherit;
          background: conic-gradient(
            from 180deg at 50% 50%,
            #0084ff,
            #90bb47,
            #153ac7,
            #0084ff
          );
          filter: blur(18px) brightness(1.4);
          animation: auroraMove 8s ease-in-out infinite alternate;
          opacity: 0.9;
        }

        .aurora-btn::after {
          content: "";
          position: absolute;
          inset: 2px;
          border-radius: inherit;
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(8px);
          transition: all 0.5s ease;
          box-shadow:
            inset 0 0 8px rgba(255, 255, 255, 0.15),
            inset 0 0 20px rgba(255, 255, 255, 0.05);
        }

        .aurora-btn:hover::after {
          background: rgba(255, 255, 255, 0.16);
          backdrop-filter: blur(14px);
          box-shadow:
            inset 0 0 12px rgba(255, 255, 255, 0.25),
            inset 0 0 28px rgba(255, 255, 255, 0.12);
        }
        
        @keyframes dissolveOut {
          0%   { opacity: 1; filter: blur(0px);   transform: scale(1); }
          100% { opacity: 0; filter: blur(10px);  transform: scale(0.98); }
        }

        @keyframes dissolveIn {
          0%   { opacity: 0; filter: blur(10px);  transform: scale(1.02); }
          100% { opacity: 1; filter: blur(0px);   transform: scale(1); }
        }

        .page-dissolve-out {
          animation: dissolveOut 450ms ease forwards;
        }

        .page-dissolve-in {
          animation: dissolveIn 450ms ease forwards;
        }
      `}</style>
      <div className="relative min-h-screen overflow-hidden -m-8">
        {/* Animated gradient background */}
        <div className="absolute inset-0 animate-gradient-bg bg-[radial-gradient(120%_120%_at_0%_0%,_#030037_0%,_#153AC7_50%,_#0084FF_100%)]"></div>

        {/* Soft glows */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl"></div>
        <div className="pointer-events-none absolute -bottom-40 -right-40 h-[36rem] w-[36rem] rounded-full bg-white/10 blur-[100px]"></div>

        {/* Content */}
        <main className="relative z-10 flex min-h-screen items-center justify-center px-6 py-10">
          <section className={`w-full max-w-4xl rounded-3xl border border-white/25 bg-white/10 backdrop-blur-xl shadow-[0_25px_80px_rgba(0,0,0,0.35)] ${
            isUserLoginTransitioning ? "page-dissolve-out" : "page-dissolve-in"
          }`}>
            <div className="px-10 py-14 text-center">
              <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.25)]">
                {textLoading ? '...' : portalText.headerTitle}
              </h1>
              <p className="mt-4 text-lg md:text-xl text-white/85">
                {textLoading ? '...' : portalText.welcomeMsg}
              </p>

              {/* BUTTON ROW */}
              <div className="mt-10 flex flex-wrap items-center justify-center gap-5">
                <button
                  type="button"
                  onClick={handleUserLoginClick}
                  className={`${baseButtonClasses} border border-[#153AC7]/60`}
                >
                  <span className="relative z-10">User Login</span>
                </button>
                {!loadingSignup && showSignup && (
                  <Link to="/signup" className={`${baseButtonClasses} border border-[#90BB47]/70`}>
                    <span className="relative z-10">Sign Up</span>
                  </Link>
                )}
                <Link to="/admin/login" className={`${baseButtonClasses} border border-[#0084FF]/70`}>
                  <span className="relative z-10">Admin Login</span>
                </Link>
              </div>
            </div>
          </section>
        </main>

        {/* Optional top gradient fade for nav separation if a navbar exists */}
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/20 to-transparent"></div>
      </div>
    </>
  );
}