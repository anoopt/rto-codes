interface FooterProps {
    /** Additional CSS classes for the footer */
    className?: string;
}

export default function Footer({ className = '' }: FooterProps) {
    return (
        <footer className={`py-4 text-center transition-colors duration-300 ${className}`}>
            <p className="text-[var(--muted-foreground)] text-xs tracking-wide">
                <a
                    href="https://rto-codes.in"
                    className="hover:text-[var(--muted)] transition-colors"
                >
                    rto-codes.in
                </a>
            </p>
        </footer>
    );
}
